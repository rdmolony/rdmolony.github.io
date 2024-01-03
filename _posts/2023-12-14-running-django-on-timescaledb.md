---
title: "Running Django on TimescaleDB"
layout: "post"
description: |
  Some thoughts on making Django & TimescaleDB play nicely
---

In [Struggling to Sync Sensors & Databases]({% post_url 2023-12-04-struggling-to-sync-sensors-and-databases %}) I reflect on rebuilding a data flow system on top of `TimescaleDB` so that I could store timeseries readings alongside a "CRUD"[^CRUD] web application.  I do not, however, discuss how I adapted a `Django`[^DJANGO] web application to play nicely with it.

[^DJANGO]: `Django` is a `Python` web framework.  In my case, it served as the "glue" between web browsers and a database.  Specifically, to display a web page it asks a database for the data it needs to render files that the browser interprets (`HTML`, `CSS` & `JavaScript`) so it can display a user interface

[^CRUD]: "CRUD" or ["Create Read Update Delete"](https://en.wikipedia.org/wiki/Create,_read,_update_and_delete) is common shorthand for a user interface that facilitates viewing, searching, and changing information using forms.

Since `TimescaleDB`[^TIMESCALEDB] is an extension to `Postgres`,  switching to `TimescaleDB` is as easy as switching to `Postgres`.  You won't, however, see much benefit if you don't adapt how you get timeseries readings into & out of the database if you want to handle a large volume of data.

[^TIMESCALEDB]: `TimescaleDB` is an extension to the `Postgres` database which grants it timeseries capabilities.  `Postgres` wasn't designed to handle timeseries workloads in which data is infrequently inserted and frequently queried in bulk.  `TimescaleDB` adapts `Postgres` via "hypertables" which enable compression of many rows into "chunks" which are indexed by timestamps.  Consequently,  queries on ranges of timestamps are faster since `Postgres` can search "chunks" instead of rows & storage is cheaper.  By compressing, `TimescaleDB` trades insert performance for query performance.

Let's walk through an example project to make these adaptations a bit more concrete.

If you want to follow along locally, you can setup a developer environment via [django-timescaledb-example](https://github.com/rdmolony/django-timescaledb-example)

> If you have any trouble getting setup,  feel free to ask a question at [django-timescaledb-example/discussions](https://github.com/rdmolony/django-timescaledb-example/discussions)


{% capture table_of_contents %}

- [Getting data in](#getting-data-in)
  - [Create an app](#create-an-app)
  - [Create a Data Model for Files](#create-a-data-model-for-files)
  - [Handle file uploads via Browser](#handle-file-uploads-via-browser)
  - [Handle file uploads via API](#handle-file-uploads-via-api)
  - [Create a Data Model for Readings](#create-a-data-model-for-readings)
  - [Import Readings](#import-readings)
  - [Handle importing readings from files](#handle-importing-readings-from-files)
- [Getting data out](#getting-data-out)

{% endcapture %}
{% include toc.html content=table_of_contents %}


---


## Getting data in

In my case all of the timeseries data originated from text files.  How do I copy data from files into `TimescaleDB` via `Django`?

The `Django` documentation covers [File Uploads](https://docs.djangoproject.com/en/5.0/topics/http/file-uploads/), however, it doesn't advise on importing file contents to a database.  One normally uses `Django` to add save new entries to `Postgres` using input from a browser:

- `Django` sends a web page to a browser containing one or more `<form>` elements
- Once filled-in, these `<form>` elements are sent back to `Django`
- `Django` processes these entries & saves them to the database using the `Django` ORM

> If any of this sounds unfamiliar to you,  consider completing out the ["Official Django Tutorial"](https://docs.djangoproject.com/en/5.0/intro/tutorial01/) before continuing on here

The key enabler here is the [ORM (or "Object Relational Mapper")](https://en.wikipedia.org/wiki/Object%E2%80%93relational_mapping).  It maps a `Python` class to a database table so that this table's data is easily accessible from within `Python`.  Without an ORM one would have to use the `SQL` language to communicate with the database.

We need to do a bit of work to adapt this workflow to handle file contents.


### Create an app

Let's first run ...

```sh
python manage.py startapp sensor
```

... to create files ...

```
sensor
├── __init__.py
├── admin.py
├── apps.py
├── migrations
│   └── __init__.py
├── models.py
├── tests.py
└── views.py
```

... and register the app in `core/settings.py` ...

```python
INSTALLED_APPS = [

    # Builtin
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    # Custom
    'sensor'
]
```


### Create a Data Model for Files

Now I can adapt `sensor/models.py` to add a `File` model to track uploaded files ...

```python
# sensor/models.py

from django.db import models


class File(models.Model):
    file = models.FileField(upload_to="readings/", blank=False, null=False)
    uploaded_at = models.DateTimeField(auto_now_add=True)
```

> `Django` tracks where files are stored via `FileField` - files are stored as files rather than within the database


... create its database migration[^MIGRATION] ...

```sh
python manage.py makemigrations sensor
```

[^MIGRATION]: A database migration is a set of instructions which specify updates to a database.  Since the database only understands `SQL` changes to `models.py` must be translated to `SQL` and rolled out via migrations in order to persist them

... and roll it out ...

```sh
python manage.py migrate
```


### Handle file uploads via Browser

Now that we have somewhere to store files of readings,  we need to handle file uploads.

This part is "standard" so it's covered by the [`Django` documentation](https://docs.djangoproject.com/en/5.0/topics/http/file-uploads/).  In a similar manner, I can create a "view" to render `HTML` to accept browser file uploads ...

```python
# sensor/views.py

from django.shortcuts import render
from django.shortcuts import redirect
from django.http import HttpResponse

from .forms import FileForm


def upload_file(request):
    if request.method == "POST":
        form = FileForm(request.POST, request.FILES)
        if form.is_valid():
            form.save()
            return HttpResponse("File upload was successful")
        else:
            return HttpResponse("File upload failed")
    else:
        form = FileForm()
    return render(request, "upload_file.html", {"form": form})
```

```python
# sensor/forms.py

from django.forms import ModelForm

from .models import File


class FileForm(ModelForm):
    class Meta:
        model = File
        fields = "__all__"
```

{% raw %}
```html
<!--- sensor/templates/upload.html -->

<form>
  {% csrf_token %}
  {{ form }}
  <input type="submit" value="Save"></input>
</form>
```
{% endraw %}

```python
# sensor/urls.py

from django.shortcuts import redirect
from django.urls import path

from . import views


app_name = "sensor"


urlpatterns = [
    path('', lambda request: redirect('sensor:upload-file')),

    path('upload-file/', views.upload_file, name="upload-file"),
]
```

This requires someone clicking through this web application every time they want to add new data.  If data is synced automatically from remote sensors to a file system somewhere, then why not setup automatic file uploads?  For this we need an API.


### Handle file uploads via API

An API (or Application Programming Interface) lets our web application accept file uploads from another program.

The `django-rest-framework` library does a lot of heavy lifting here so let's use it.

> If you have never used `django-rest-framework` consider first completing the ["Official Django Rest Framework Tutorial"](https://www.django-rest-framework.org/tutorial/quickstart/) before continuing on here

We can use a "viewset" to automatically create an endpoint (like `/api/sensor/file/`) that accepts file uploads ...

```python
# sensor/api/viewsets.py

from rest_framework import viewsets

from ..models import File
from .serializers import FileSerializer


class FileViewSet(viewsets.ReadOnlyModelViewSet):
    """
    This viewset automatically provides `list` and `retrieve` actions.
    """
    queryset = File.objects.all()
    serializer_class = FileSerializer
```

```python
# sensor/api/serializers.py

from rest_framework import serializers

from ..models import File


class FileSerializer(serializers.ModelSerializer):
    class Meta:
        model = File
        fields = ['__all__']
```

```python
# sensor/api_urls.py

from django.urls import include
from django.urls import path
from rest_framework.routers import DefaultRouter

from .api import viewsets


app_name = "sensor"


router = DefaultRouter()
router.register('file', viewsets.FileViewSet)


urlpatterns = [
    path('', include(router.urls)),
]
```


### Create a Data Model for Readings

Let's add a `Reading` model to store readings by adapting `sensor/models.py`[^DJANGO_TABLE_NAME] ...

```python
# sensor/models.py

from django.db import models

# ....

class Reading(models.Model):
    timestamp = models.DateTimeField(blank=False, null=False)
    sensor_name = models.TextField(blank=False, null=False)
    reading = models.FloatField(blank=False, null=False)
```

... & thus (again) create its migration & roll it out to create table `sensor_reading`[^DJANGO_TABLE_NAME] in the database.

[^DJANGO_TABLE_NAME]: `Django` automatically infers `sensor_` in the table name from the name of the app


If I connect to the database[^DBEAVER] I can see that this has been created with three columns: `id`, `sensor_name` & `reading`.   Where did `id` come from?  By default,  `Django` creates tables with an automatically incrementing `id` column (a `PRIMARY KEY`) which uniquely identifies each row.  Every time a new row is added to this table,  `id` increments by one. 

[^DBEAVER]: I use [`DBeaver`](https://github.com/dbeaver/dbeaver),  I could also just use `psql` which ships with `Postgres`

Don't we want to store readings in a `Hypertable`[^TIMESCALEDB] to make them easier to work with?  `Django` won't automatically create a `Hypertable` (it wasn't designed to) so we need to do so ourselves.

Let's create an empty migration ...

```sh
python manage.py makemigrations sensor --empty --name "sensor_reading"
```

... and manually edit it ourselves ...

```python
# sensor/migrations/0002_sensor_reading.py

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
    ]

    operations = [
        migrations.RunSQL(
            """
            CREATE TABLE sensor_reading (
                timestamp TIMESTAMP NOT NULL,
                sensor_name TEXT NOT NULL,
                reading FLOAT
            );
            SELECT create_hypertable('sensor_reading', 'timestamp');
            """,
            reverse_sql="""
                DROP TABLE sensor_reading;
            """
        ),
    ]
```

Since we are managing this table ourselves, we also have to adapt `sensor/models.py` so that `Django` ignores it, and doesn't attempt to create an `id` column ...

```python
# sensor/models.py

from django.db import models

class Reading(models.Model):
    timestamp = models.DateTimeField(blank=False, null=False)
    sensor_name = models.TextField(blank=False, null=False)
    reading = models.FloatField(blank=False, null=False)
    
    class Meta:
        managed = False
```

> Note that this table does not include an auto-generated `id` column as `PRIMARY KEY` like the previous data model.  We don't necessarily need a primary key unless we really care about blocking the saving of duplicate `timestamp, sensor_name`.


Now we can roll out migrations ...

```sh
python manage.py migrate
```

... & connect to the database[^DBEAVER] to see the newly created `Hypertable`.


### Import Readings

In my case each file source had its own conventions (for datetime column names, datetime string formats & encodings), so I had to standardise each file to a data model before import.



### Handle importing readings from files


Naively, one might then ...

```python
import csv

from .models import SensorReading


sensor_readings_file = "readings.csv"

with open(file) as f:
    for line in f:
        destination.write(chunk)
```

---


## Getting data out
