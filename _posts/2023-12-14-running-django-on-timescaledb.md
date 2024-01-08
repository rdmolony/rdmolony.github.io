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

If you want to follow along locally, you can setup a developer environment via [`django-timescaledb-example`](https://github.com/rdmolony/django-timescaledb-example)

> If you have any trouble getting setup,  feel free to ask a question at [`django-timescaledb-example/discussions`](https://github.com/rdmolony/django-timescaledb-example/discussions)

> This tutorial assumes some familiarity with `Django` or a similar web framework.  If you have never used `Django` I highly recommend [the official tutorial](https://docs.djangoproject.com/en/5.0/intro/tutorial01/)


{% capture table_of_contents %}

- [Getting data in](#getting-data-in)
  - [Create an app](#create-an-app)
  - [Create a home page](#create-a-home-page)
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

### Create a home page

Let's quickly create a home page which will be displayed on first opening this web application in a browser ...

```python
# sensor/views.py

from django.shortcuts import render


def index(request):
    return render(request, "index.html")
```

{% raw %}
```html
<!--- sensor/templates/index.html -->

<div style="text-align: center">
  <h1>django-timescaledb-example</h1>
</div>
```
{% endraw %}

```python
# sensor/urls.py

from django.urls import path

from . import views


app_name = "sensor"


urlpatterns = [
    path('', views.index, name="root"),
]
```

```python
# core/urls.py

from django.contrib import admin
from django.shortcuts import redirect
from django.urls import include
from django.urls import path


urlpatterns = [
    path('', lambda request: redirect('sensor:root')),

    path('admin/', admin.site.urls),
    path('sensor/', include('sensor.urls')),
]
```

Now [`http://localhost:8000`](http://localhost:8000) should display a single line of text "django-timescaledb-example".  We can build on this `index.html` to link to other pages.

### Create a Data Model for Files

Now I can adapt `sensor/models.py` to add a `File` model to track uploaded files ...

```python
# sensor/models.py

class File(models.Model):
    file = models.FileField(upload_to="readings/", blank=False, null=False)
    uploaded_at = models.DateTimeField(auto_now_add=True)
    parsed = models.DateTimeField(blank=False, null=False)
    parse_error = models.TextField(blank=True, null=True)
```

... create its database migration[^MIGRATION] ...

```sh
python manage.py makemigrations sensor
```

[^MIGRATION]: A database migration is a set of instructions which specify updates to a database.  Since the database only understands `SQL` changes to `models.py` must be translated to `SQL` and rolled out via migrations in order to persist them

... and roll it out ...

```sh
python manage.py migrate
```

> Any change to `sensor/models.py` requires a corresponding database migration


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

```html
{% raw %}
<!--- sensor/templates/upload.html -->

<div style="text-align: center">
  <h1>Upload File</h1>
  <form enctype="multipart/form-data" method="post">
    {% csrf_token %}
    {% for field in form %}
      <div style="margin-bottom: 10px">
        {{ field.label_tag }}
        {{ field }}
        {% if field.help_text %}
          <span class="question-mark" title="{{ field.help_text }}">&#63;</span>
        {% endif %}
      </div>
    {% endfor %}
    <input type="submit" value="Save"></input>
  </form>
</div>
{% endraw %}
```

```python
# sensor/urls.py

from django.urls import path

from . import views


app_name = "sensor"


urlpatterns = [
    path('upload-file/', views.upload_file, name="upload-file"),
]
```

This requires someone clicking through this web application every time they want to add new data.  If data is synced automatically from remote sensors to a file system somewhere, then why not setup automatic file uploads?  For this we need an API.


### Handle file uploads via API

An API (or Application Programming Interface) lets our web application accept file uploads from another program.

The `django-rest-framework` library does a lot of heavy lifting here so let's use it.

> If you have never used `django-rest-framework` consider first completing the [official tutorial](https://www.django-rest-framework.org/tutorial/quickstart/) before continuing on here

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

> Similarly to `sensor/views.py` each change to `sensor/api/viewsets.py` requires a corresponding route in `sensor/api_urls.py`.  See [`django-timescaledb-example``](https://github.com/rdmolony/django-timescaledb-example) for the full details. 


### Create a Data Model for Readings

Let's add a `Reading` model to store readings ...

```python
# sensor/models.py

from django.db import models

# ....

class Reading(models.Model):

    class Meta:
        managed = False

    file = models.ForeignKey(File, on_delete=models.RESTRICT)
    timestamp = models.DateTimeField(blank=False, null=False, primary_key=True)
    sensor_name = models.TextField(blank=False, null=False)
    reading = models.TextField(blank=False, null=False)

```

[^DJANGO_TABLE_NAME]: `Django` automatically infers `sensor_` in the table name from the name of the app

This time we're using `timestamp` instead of the default `id` field as a primary key,  since row uniqueness can be defined by a composite of `file`, `timestamp` & `sensor_name` if required.

Don't we want to store readings in a `Hypertable`[^TIMESCALEDB] to make them easier to work with?  `Django` won't automatically create a `Hypertable` (it wasn't designed to) so we need to do so ourselves.  Since we need to customise table creation ourselves rather than letting `Django` do it we need to set `managed` to `False`.  Let's create a "base" migration ...

```sh
python manage.py makemigrations sensor --name "sensor_reading"
```

... and manually edit the migration ...

```python
# sensor/migrations/0002_sensor_reading.py

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('sensor', '0001_initial')
    ]
    operations = [
        migrations.CreateModel(
            name='Reading',
            fields=[
                ('file', models.ForeignKey(default=None, on_delete=django.db.models.deletion.RESTRICT, to='sensor.file')),
                ('timestamp', models.DateTimeField(primary_key=True)),
                ('sensor_name', models.TextField()),
                ('reading', models.FloatField()),
            ],
            options={
                'managed': False,
            },
        ),
        migrations.RunSQL(
            """
            CREATE TABLE sensor_reading (
                file_id INTEGER NOT NULL REFERENCES sensor_file (id),
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

Now we can roll out migrations ...

```sh
python manage.py migrate
```

... & connect to the database[^DBEAVER] to inspect the newly created `Hypertable`.

[^DBEAVER]: I use [`DBeaver`](https://github.com/dbeaver/dbeaver),  I could also just use `psql` which ships with `Postgres`


### Import Readings

In my case each file source had its own conventions (for datetime column names, datetime string formats & encodings), so I had to standardise each file to a data model before import.

What if each file contains a few gigabytes of readings?  Won't this take an age to process?

If you can't guarantee that the sensor files are small enough that they can be processed quickly then you might need to offload file importing to a task queue.

> A task queue works like a restaurant.  The waiters add an order to the queue & the chefs pull orders from the queue when they have time to process it.

`Celery` is a mature `Python` task queue library & works well with `Django`.  It supports `Redis` which acts as the intermediary between "waiters" & "chefs" using the above analogy (or message broker).





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
