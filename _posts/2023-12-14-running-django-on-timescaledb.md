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
  - [Create a database table](#create-a-database-table)
  - [Create a database hypertable](#create-a-database-hypertable)
  - [Handle file uploads](#handle-file-uploads)
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


### Create a database table

I can now adapt `sensor/models.py`[^DJANGO_TABLE_NAME] ...

```python
# models.py

from django.db import models

class Reading(models.Model):
    sensor_name = models.TextField()
    reading = models.FloatField()
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

... to create table `sensor_reading`[^DJANGO_TABLE_NAME] in the database.

[^DJANGO_TABLE_NAME]: `Django` automatically infers `sensor_` from the name of the app

If I connect to the database[^DBEAVER] I can see that this has been created with three columns: `id`, `sensor_name` & `reading`.   Where did `id` come from?  By default,  `Django` creates tables with an automatically incrementing `id` column (a `PRIMARY KEY`) which uniquely identifies each row.  Every time a new row is added to this table,  `id` increments by one. 

[^DBEAVER]: I use [`DBeaver`](https://github.com/dbeaver/dbeaver),  I could also just use `psql` which ships with `Postgres`


### Create a database hypertable

Don't we want to store readings in a `Hypertable`[^TIMESCALEDB] to make them easier to work with?  `Django` won't automatically create a `Hypertable`, so we need to do so ourselves.

Let's undo our migration & try again ...

```sh

```


### Handle file uploads



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
