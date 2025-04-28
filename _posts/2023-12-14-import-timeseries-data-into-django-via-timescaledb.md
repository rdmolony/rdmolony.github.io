---
title: "Import Timeseries Data into Django via TimescaleDB"
layout: "post"
description: |
  In this tutorial I explain how to import timeseries data from text files into a Django web application connected to TimescaleDB, an extension to the Postgres relational database. I also argue that TimescaleDB and Django make quite a good match because TimescaleDB, unlike many other timeseries databases, allows one to store timeseries data alongside web application data.
archived: false
how_to: true
---


{% capture table_of_contents %}

- [Intro](#intro)
- [Create a Sensor Data App Using Django](#create-a-sensor-data-app-using-django)
- [Create a Homepage](#create-a-homepage)
- [Create a Data Model for Files](#create-a-data-model-for-files)
- [Handle File Uploads via Browser](#handle-file-uploads-via-browser)
- [Create an API home page](#create-an-api-home-page)
- [Handle file uploads via API](#handle-file-uploads-via-api)
- [Create a Data Model for Readings](#create-a-data-model-for-readings)
- [Import Files](#import-files)
- [Import Files via Celery](#import-files-via-celery)
- [Next Steps?](#next-steps)
- [Bonus](#bonus)
  - [Import Messy Files](#import-messy-files)
  - [Validate Messy Files](#validate-messy-files)
  - [Import and Validate Messy Files](#import-and-validate-messy-files)
- [Footnotes](#footnotes)

{% endcapture %}
{% include toc.html content=table_of_contents %}

---

## Intro

> This post was developed in collaboration with `TimescaleDB` & is also available on the [`TimescaleDB` Blog](https://www.timescale.com/blog/getting-sensor-data-into-timescaledb-via-django/)

Over 2022-23 while working at `Mainstream Renewable Power` on an internal web application, I maintained a "data pipeline" that fetches files of sensor data readings from the world's most remote places, and transforms them into useful datasets.  These datasets form the basis upon which the construction of renewables (wind turbines or solar panels) on site hinges.  I rebuilt the pipeline on top of `TimescaleDB`[^TIMESCALEDB], which enabled me to massively reduce the complexity of the system involved.

[^TIMESCALEDB]: Don’t know what TimescaleDB is? [Read this article](https://www.timescale.com/learn/is-postgres-partitioning-really-that-hard-introducing-hypertables).

> I reflect on this experience in detail in [Struggling to Sync Sensors & Databases]({% post_url 2023-12-04-struggling-to-sync-sensors-and-databases %}).  

I do not, however, discuss how I adapted `Django` to play nicely with this database.  In my case, `Django` served as the “glue” between web browsers and the database. Specifically, to display a web page, it asks a database for the data it needs to render files that the browser interprets (HTML, CSS, and JavaScript) so it can display a user interface.

Let's walk through an example project to make these adaptations a bit more concrete.

This tutorial assumes some familiarity with `Django` or a similar web framework.  If you have never used `Django` I highly recommend [the official tutorial](https://docs.djangoproject.com/en/5.0/intro/tutorial01/)


> If you want to follow along locally, you can setup a developer environment via [`django-timescaledb-example`](https://github.com/rdmolony/django-timescaledb-example)

> If you have any trouble getting setup,  feel free to ask a question at [`django-timescaledb-example/discussions`](https://github.com/rdmolony/django-timescaledb-example/discussions)


---


## Create a Sensor Data App Using Django

Let's first run

```sh
python manage.py startapp sensor
```

to create files

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

and register the app in `core/settings.py`

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


---


## Create a Homepage

Let's quickly create a home page which will be displayed on first opening this web application in a browser.

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

So now [`http://localhost:8000`](http://localhost:8000) should display `index.html`.  We can build on this `index.html` to link to other pages.


---


## Create a Data Model for Files

Now I can adapt `sensor/models.py` to add a `File` model to track uploaded files,

```python
# sensor/models.py

class File(models.Model):
    file = models.FileField(upload_to="readings/", blank=False, null=False)
    uploaded_at = models.DateTimeField(auto_now_add=True)
    parsed = models.DateTimeField(blank=False, null=False)
    parse_error = models.TextField(blank=True, null=True)
```

create its database migration[^MIGRATION]

```sh
python manage.py makemigrations sensor
```

[^MIGRATION]: A database migration is a set of instructions which specify updates to a database.  Since the database only understands `SQL` changes to `models.py` must be translated to `SQL` and rolled out via migrations in order to persist them

and roll it out

```sh
python manage.py migrate
```

> Any change to `sensor/models.py` requires a corresponding database migration!


---


## Handle File Uploads via Browser

Now that we have somewhere to store files of readings,  we need to handle file uploads.

Let’s consider only the case where time-series data originates only from text files. How do I copy data from files into TimescaleDB via Django?

The `Django` documentation covers [File Uploads](https://docs.djangoproject.com/en/5.0/topics/http/file-uploads/).  However, it doesn’t advise on importing file contents to a database. One normally uses `Django` to add and save new entries to a database using input from a browser:

- `Django` sends a web page to a browser containing one or more `<form>` elements.
- Once filled in, these `<form>` elements are sent back to Django.
- `Django` processes these entries and saves them to the database using the `Django ORM`.

The key enabler here is the [ORM (or “Object Relational Mapper”)](https://en.wikipedia.org/wiki/Object%E2%80%93relational_mapping). It maps a Python class to a database table so that this table’s data is easily accessible from within Python. Without an ORM, one would have to use the SQL language to communicate with the database.

We need to do a bit of work to adapt this workflow to handle file contents.

In a similar manner, I can create a “view” to render `HTML` to accept browser file uploads:

```python
# sensor/views.py

from django.shortcuts import render
from django.shortcuts import redirect
from django.http import HttpResponse

from .forms import FileForm


# ...


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


# ...
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
<!--- sensor/templates/upload_file.html -->

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
```
{% endraw %}

```python
# sensor/urls.py

from django.urls import path

from . import views


app_name = "sensor"


urlpatterns = [
    path('', views.index, name="root"),
    path('upload-file/', views.upload_file, name="upload-file"),
]
```

This requires someone clicking through this web application every time they want to add new data.  If data is synced automatically from remote sensors to a file system somewhere, then why not setup automatic file uploads?  For this we need an API.

An API (or Application Programming Interface) lets our web application accept file uploads from another program.

The `django-rest-framework` library does a lot of heavy lifting here so let's use it.

> If you are not interested in APIs feel free to skip the API sections

> If you have never used `django-rest-framework` consider first completing the [official tutorial](https://www.django-rest-framework.org/tutorial/quickstart/) before continuing on here


---


## Create an API home page

As suggested by [`Two Scoops of Django 3.x`](https://www.feldroy.com/books/two-scoops-of-django-3-x) let's create `core/api_urls.py` to wire up our API.

```python
# core/urls.py

from django.contrib import admin
from django.shortcuts import redirect
from django.urls import include
from django.urls import path


urlpatterns = [
    path('', lambda request: redirect('sensor:root')),

    path('admin/', admin.site.urls),
    path('api/', include('core.api_urls')),
    path('sensor/', include('sensor.urls')),
]
```

```python
# core/api_urls.py

from django.urls import include
from django.urls import path
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework.reverse import reverse


app_name = "api"


@api_view(['GET'])
def api_root(request, format=None):
    return Response({
        'sensors': reverse('api:sensor:api-root', request=request, format=format),
    })


urlpatterns = [
    path('', api_root, name="api-root"),
    path('sensor/', include('sensor.api_urls'), name='sensor'),
]
```

```python
# core/api_urls.py

from django.urls import include
from django.urls import path
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework.reverse import reverse

from .api import viewsets


app_name = "sensor"


@api_view(['GET'])
def api_root(request, format=None):
    return Response({})


urlpatterns = [
    path('', api_root, name="api-root"),
]
```

So now we can add new views and/or viewsets to `sensor/api_urls.py` and they will be "connectable" via `/api/sensor/`


---


## Handle file uploads via API

We can use a "viewset" to create an endpoint like `/api/sensor/file/` to which another program can upload files:

```python
# sensor/api/viewsets.py

from rest_framework import viewsets

from ..models import File
from .serializers import FileSerializer


class FileViewSet(viewsets.ReadOnlyModelViewSet):
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


---


## Create a Data Model for Readings

Let's add a `Reading` model to store readings:

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

This time we're using `timestamp` instead of the default `id` field as a primary key,  since row uniqueness can be defined by a composite of `file`, `timestamp` and `sensor_name` if required.

Don't we want to store readings in a `TimescaleDB` `Hypertable`[^TIMESCALEDB] to make them easier to work with?  `Django` won't automatically create a `Hypertable` (it wasn't designed to) so we need to do so ourselves.  Since we need to customise table creation ourselves rather than letting `Django` do it we need to set `managed` to `False`.

Let's create a "base" migration,

```sh
python manage.py makemigrations sensor --name "sensor_reading"
```

and manually edit the migration:

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

Now we can roll out migrations,

```sh
python manage.py migrate
```

and connect to the database[^DBEAVER] to inspect the newly created `Hypertable`.

[^DBEAVER]: I use [`DBeaver`](https://github.com/dbeaver/dbeaver),  one could also just use `psql` which ships with `Postgres`


---


## Import Files

Let's imagine that all of our readings are stored nicely formatted in `JSON` files, like:

```json
[
    {
      "reading": 20.54,
      "sensor_name": "M(m/s)",
      "timestamp": "2015-12-22 00:00:00",
    },
    {
      "reading": 211.0,
      "sensor_name": "D(deg)",
      "timestamp": "2015-12-22 00:00:00",
    },
]
```

How do we import these readings?

We can add a method to `File` to bring the `JSON` file into `Python` and create a new `Reading` entry for each reading in the file:

```python
# sensor/models.py

from datetime import datetime
from datetime import timezone
from itertools import islice

from django.contrib.postgres.fields import ArrayField
from django.db import models
from django.db import transaction

from .io import validate_datetime_fieldnames_in_lines
from .io import yield_readings_in_narrow_format


# ...


class File(models.Model):

    # ...

    def import_to_db(self):

        # NOTE: assume uploaded file is JSON
        with self.file.open(mode="rb") as f:

            reading_objs = (
                Reading(
                    file=self,
                    timestamp=r["timestamp"],
                    sensor_name=r["sensor_name"],
                    reading=r["reading"]
                )
                for r in json.load(f)
            )

            batch_size = 1_000

            with transaction.atomic():
                while True:
                    batch = list(islice(reading_objs, batch_size))
                    if not batch:
                        break
                    Reading.objects.bulk_create(batch, batch_size)
```

How do we call the `import_to_db` method?

We can go about this a few different ways but perhaps the simplest is just to implement it directly in the views and viewsets so that it will be triggered on browser and API file uploads.

For `Django` we can call it directly in our `upload-file` view like:

```python
if form.is_valid():
    form.save()
    form.instance.import_to_db()
```

And for `django-rest-framework` we can override the `perform_create` method.

```python
class FileViewSet(viewsets.ModelViewSet):

    # ...

    def perform_create(self, serializer):
        instance = serializer.save()
        instance.import_to_db()
```


---


## Import Files via Celery

What if each file contains a few gigabytes of readings?  Won't this take an age to process?

If you can't guarantee that the sensor files are small enough that they can be processed quickly then you might need to offload file importing to a task queue.

> A task queue works like a restaurant.  The waiters add an order to the queue and the chefs pull orders from the queue when they have time to process it.

`Celery` is a mature `Python` task queue library and works well with `Django` so let's use it.  It coordinates "waiters" and "chefs" using the above analogy by leveraging a database (or message broker), typically `Redis` or `RabbitMQ`.

A task queue can significantly improves performance here.  It makes file uploads instant from the user's perspective, since now file upload tasks are added to a queue rather than run immediately.  It also enables parallel processing of files since task queue workers run in parallel to one another.

> `Celery` may not work well on `Windows`, so consider trying `dramatiq` instead if this is a hard requirement

> Why not use `Postgres` as a message broker?  The [`django-q`](https://github.com/Koed00/django-q) implements enables this via the `Django ORM` message broker.  For small-scale applications this might be a better choice since it reduces system complexity

To setup `Celery`, we can follow their [official tutorial](https://docs.celeryq.dev/en/main/django/first-steps-with-django.html):

```python
# core/celery.py

import os

from celery import Celery

# Set the default Django settings module for the 'celery' program.
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')

app = Celery('core')

# Using a string here means the worker doesn't have to serialize
# the configuration object to child processes.
# - namespace='CELERY' means all celery-related configuration keys
#   should have a `CELERY_` prefix.
app.config_from_object('django.conf:settings', namespace='CELERY')

# Load task modules from all registered Django apps.
app.autodiscover_tasks()


@app.task(bind=True, ignore_result=True)
def debug_task(self):
    print(f'Request: {self.request!r}')
```

```python
# core/settings.py

# ...

CELERY_BROKER_URL = "redis://localhost:6379/0"
```

So now we can add tasks to `sensor/tasks.py` like:

```python
# sensor/tasks.py

from celery import shared_task

from .models import File


@shared_task
def import_to_db(file_id):
    file_obj = File.objects.get(id=file_id)
    file_obj.import_to_db()
```

And replace all calls to `<file_obj>.import_to_db()` with `tasks.import_to_db(file_obj)`, and this task won't be run immediately but rather will be run by `Celery` when it has availability to do so!


---


## Next Steps?

If you really want to further eke out import performance you'll have to go deeper and experiment with:

- **Batch sizes**: how many readings do you want to save at once?
- **Compression**: `TimescaleDB` really shines once `Hypertables` are compressed since it reduces storage costs and faster analytics queries


---


## Bonus

### Import Messy Files

How do we convert files like

```
Lat=0  Lon=0  Hub-Height=160  Timezone=00.0  Terrain-Height=0.0
Computed at 100 m resolution
 
YYYYMMDD HHMM   M(m/s) D(deg) SD(m/s)  DSD(deg)  Gust3s(m/s)    T(C)    PRE(hPa)       RiNumber  VertM(m/s)
20151222 0000  20.54   211.0    1.22       0.3        21.00     11.9      992.8            0.15    0.18
20151222 0010  21.02   212.2    2.55       0.6        21.35     11.8      992.7            0.29   -0.09
```

into

```python
[
    {
      'reading': '20.54',
      'sensor_name': 'M(m/s)',
      'timestamp': datetime.datetime(2015, 12, 22, 0, 0),
    },
    {
      'reading': '211.0',
      'sensor_name': 'D(deg)',
      'timestamp': datetime.datetime(2015, 12, 22, 0, 0),
    },
    # ...
)
```

so we can store them in the `Reading` data model?

In this file `YYYYMMDD` and `HHMM` clearly represent the timestamp and so `20151222 0000` corresponds to `datetime.datetime(2015, 12, 22, 0, 0)`.  However, this may differ between sources.

One way to generalise the importer is to upload a `FileType` specification alongside each file so we know how to standardise it.

We can create a new model `FileType` and link it to `File` like:

```python
# sensor/models.py

from django.contrib.postgres.fields import ArrayField
from django.db import models


class FileType(models.Model):

    name = models.TextField()
    na_values = ArrayField(
        base_field=models.CharField(max_length=10),
        default=["NaN"],
        help_text=textwrap.dedent(
            r"""A list of strings to recognise as empty values.
            
            Default: ["NaN"]

            Note: "" is also included by default

            Example: ["NAN", "-9999", "-9999.0"]
            """
        ),
    )
    delimiter = models.CharField(
        max_length=5,
        help_text=textwrap.dedent(
            r"""The character used to separate fields in the file.
            
            Default: ","
            
            Examples: "," or ";" or "\s+" for whitespace or "\t" for tabs
            """
        ),
        default=",",
    )
    datetime_fieldnames = ArrayField(
        base_field=models.CharField(max_length=50),
        default=["Tmstamp"],
        help_text=textwrap.dedent(
            r"""A list of datetime field names.
            
            Examples:
            
            1) Data has a single datetime field named "Tmstamp" which has values like
            '2021-06-29 00:00:00.000':  ["Tmstamp"]

            2) Data has two datetime fields named "Date" and "Time" which have values
            like '01.01.1999' and '00:00' respectively: ["Date","Time"]
            """
        ),
    )
    encoding = models.CharField(
        max_length=25,
        help_text=textwrap.dedent(
            r"""The encoding of the file.

            Default: "utf-8"

            Examples: utf-8 or latin-1 or cp1252
            """
        ),
        default="utf-8",
    )
    datetime_formats = ArrayField(
        base_field=models.CharField(max_length=25),
        help_text=textwrap.dedent(
            r"""The datetime format of `datetime_columns`.

            See https://docs.python.org/3/library/datetime.html#strftime-and-strptime-format-codes
            for format codes

            Default: "%Y-%m-%d %H:%M:%S"

            Examples: "%Y-%m-%d %H:%M:%S" for "2021-03-01 00:00:00"
            """
        ),
        default=[r"%Y-%m-%d %H:%M:%S"],
    )



class File(models.Model):

    # ...
    type = models.ForeignKey(FileType, on_delete=models.RESTRICT)
    # ...
```

`Django` forms are smart enough to automatically render the `upload-file` view with a `type` field since we specified `fields = "__all__"` in `sensor/forms.py`.

`django-rest-framework` viewsets will also include it thanks to `fields = "__all__"` in `sensor/api/serializers.py`.  However, its default behaviour for foreign keys is not ideal.  It expects to recieve a numeric `id` for field `type`, whereas it's more intuitive to specify the `name` field instead.

We can easily override this default behaviour by specifying `SlugRelatedField` in our serializer:

```python
# sensor/api/serializers.py

from rest_framework import serializers

from ..models import File
from ..models import FileType


class FileSerializer(serializers.ModelSerializer):

    type = serializers.SlugRelatedField(
        slug_field="name", queryset=FileType.objects.all()
    )

    class Meta:
        model = File
        fields = '__all__'
```

so we can create files by passing the endpoint a payload like:

```json
{
    "file": "file",
    "type": "name-of-file-type",
}
```

Now we have all of the information we need to extract timeseries from files into our data model.


---


### Validate Messy Files

What if a `File` is created with an inappropriate `FileType`?  How do we catch this before it causes importing to fail?  

We can implement a `clean` method on `File`!  `Django` will automatically call this method on running `form.is_valid()` in our view, however, we'll have to connect `django-rest-framework` ourselves.  We can just add a `validate` method to our serializer to achieve the same behaviour.

```python
# sensor/api/serializers.py

from rest_framework import serializers

from ..models import File
from ..models import FileType


class FileSerializer(serializers.ModelSerializer):

    # ...

    def validate(self, attrs):
        instance = File(**attrs)
        instance.clean()
        return attrs
```

Now we can implement the `clean` method to check file contents prior to saving a file:

```python
# sensor/models.py

from django.db import models
from django.core.exceptions import ValidationError

from .io import validate_datetime_fieldnames_in_lines

# ...

class File(models.Model):

    # ...

    def clean(self):

        if self.type is None:
            raise ValidationError("File type must be specified!")

        # NOTE: This file is automatically closed upon saving a model instance
        # ... each time a file is read the file pointer must be reset to enable rereads
        f = self.file.open(mode="rb")

        # NOTE: automatically called by Django Forms and DRF Serializer Validate Method
        validate_datetime_fieldnames_in_lines(
            lines=f,
            encoding=self.type.encoding,
            delimiter=self.type.delimiter,
            datetime_fieldnames=self.type.datetime_fieldnames,
        )
        self.file.seek(0)


# ...
```

```python
# sensor/io.py

import re
import typing

from django.core.exceptions import ValidationError


def yield_split_lines(
    lines: typing.Iterable[bytes],
    encoding: str,
    delimiter: str,
) -> typing.Iterator[typing.Tuple[typing.Any]]:

    # Unescape strings `\\t` to `\t` for use in a regular expression
    # https://stackoverflow.com/questions/1885181/how-to-un-escape-a-backslash-escaped-string
    unescape_backslash = lambda s: (
        s.encode('raw_unicode_escape').decode('unicode_escape')
    )
    split = lambda s: re.split(unescape_backslash(delimiter), s)
    return (split(line.decode(encoding)) for line in iter(lines))


def validate_datetime_fieldnames_in_lines(
    lines: typing.Iterable[bytes],
    encoding: str,
    delimiter: str,
    datetime_fieldnames: typing.Iterable[str],
) -> None:

    split_lines = yield_split_lines(lines=lines, encoding=encoding, delimiter=delimiter)
    fieldnames = None

    for line in split_lines:
        if set(datetime_fieldnames).issubset(set(line)):
            fieldnames = line
            break
    
    if fieldnames == None:
        raise ValidationError(f"No `datetime_fieldnames` {datetime_fieldnames} found!")
```


---


### Import and Validate Messy Files

Now we have everything we need to import files:

```python
# sensor/models.py

from datetime import datetime
from datetime import timezone
from itertools import islice

from django.contrib.postgres.fields import ArrayField
from django.db import models
from django.db import transaction

from .io import validate_datetime_fieldnames_in_lines
from .io import yield_readings_in_narrow_format


# ...


class File(models.Model):

    # ...

    def import_to_db(self):

        with self.file.open(mode="rb") as f:
    
            reading_objs = (
                Reading(
                    file=self,
                    timestamp=r["timestamp"],
                    sensor_name=r["sensor_name"],
                    reading=r["reading"]
                )
                for r in yield_readings_in_narrow_format(
                    lines=f,
                    encoding=self.type.encoding,
                    delimiter=self.type.delimiter,
                    datetime_fieldnames=self.type.datetime_fieldnames,
                    datetime_formats=self.type.datetime_formats,
                )
            )

            batch_size = 1_000
        
            try:
                with transaction.atomic():
                    while True:
                        batch = list(islice(reading_objs, batch_size))
                        if not batch:
                            break
                        Reading.objects.bulk_create(batch, batch_size)

            except Exception as e:
                self.parsed_at = None
                self.parse_error = str(e)
                self.save()
                raise e

            else:
                self.parsed_at = datetime.now(timezone.utc)
                self.parse_error = None
                self.save()
```

```python
# sensor/io.py

from collections import OrderedDict
from datetime import datetime
import re
import typing

from django.core.exceptions import ValidationError


# ...


def yield_readings_in_narrow_format(
    lines: typing.Iterable[bytes],
    encoding: str,
    delimiter: str,
    datetime_fieldnames: typing.Iterable[str],
    datetime_formats: typing.Iterable[str],
) -> typing.Iterator[typing.Tuple[typing.Any]]:
    """
    https://en.wikipedia.org/wiki/Wide_and_narrow_data
    """

    split_lines = yield_split_lines(lines=lines, encoding=encoding, delimiter=delimiter)
    fieldnames = None

    for line in split_lines:
        if set(datetime_fieldnames).issubset(set(line)):
            fieldnames = line
            break
    
    if fieldnames == None:
        raise ValidationError(f"No `datetime_fieldnames` {datetime_fieldnames} found!")

    # NOTE: `split_lines` is an iterator so prior loop exhausts the header lines
    for line in split_lines:
        fields = OrderedDict([(f, v) for f, v in zip(fieldnames, line)])
        readings = OrderedDict(
            [(f, v) for f, v in fields.items() if f not in datetime_fieldnames]
        )

        timestamp_strs = [fields[k] for k in datetime_fieldnames]
        timestamp_str = " ".join(
            str(item) for item in timestamp_strs if item is not None
        )

        for datetime_format in datetime_formats:
            try:
                timestamp = datetime.strptime(timestamp_str, datetime_format)
            except ValueError:
                pass
            else:
                for sensor, reading in readings.items():
                    yield {
                        "timestamp": timestamp,
                        "sensor_name": sensor,
                        "reading": reading,
                    }
```

Once again, let’s adapt the views and viewsets to call the `import_to_db` method.

For `Django` we can call it directly in our `upload-file` view like

```python
if form.is_valid():
    form.save()
    form.instance.import_to_db()
```

And for `django-rest-framework` we can override the `perform_create` method:

```python
class FileViewSet(viewsets.ModelViewSet):

    # ...

    def perform_create(self, serializer):
        instance = serializer.save()
        instance.import_to_db()
```


---


## Footnotes
