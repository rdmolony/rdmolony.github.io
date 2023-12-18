---
title: "Running Django on TimescaleDB"
layout: "post"
description: |
  Some thoughts on making Django & TimescaleDB play nicely
---

In [Struggling to Sync Sensors & Databases]({% post_url 2023-12-04-struggling-to-sync-sensors-and-databases %}) I reflect on rebuilding a data flow system on top of `TimescaleDB` so that I could store timeseries readings alongside a "CRUD"[^CRUD] web application.  I do not, however, discuss how I adapted a `Django` web application to play nicely with it.

[^CRUD]: "CRUD" or ["Create Read Update Delete"](https://en.wikipedia.org/wiki/Create,_read,_update_and_delete) is common shorthand for a user interface that facilitates viewing, searching, and changing information using forms.

Since `TimescaleDB` is an extension to `Postgres`,  switching to `TimescaleDB` is as easy as switching to `Postgres`.  You won't, however, see much benefit if you don't adapt how you get timeseries readings into & out of the database if you want to handle a large volume of data.

Let's walk through an example project to make these adaptations a bit more concrete.

{% capture table_of_contents %}

- [Getting Started](#getting-started)
- [Getting data in](#getting-data-in)
- [Getting data out](#getting-data-out)

{% endcapture %}
{% include toc.html content=table_of_contents %}

> `TimescaleDB` is an extension to the `Postgres` database which grants it timeseries capabilities.  `Postgres` wasn't designed to handle timeseries workloads in which data is infrequently inserted and frequently queried in bulk.  `TimescaleDB` adapts `Postgres` via "hypertables" which enable compression of many rows into "chunks" which are indexed by timestamps.  Consequently,  queries on ranges of timestamps are faster since `Postgres` can search "chunks" instead of rows & storage is cheaper.  By compressing, `TimescaleDB` trades insert performance for query performance.

> `Django` is a `Python` web framework.  In my case, it served as the "glue" between web browsers and a database.  Specifically, to display a web page it asks a database for the data it needs to render files that the browser interprets (`HTML`, `CSS` & `JavaScript`) so it can display a user interface


---


## Getting Started

First setup a local developer environment by following [django-timescaledb-example](https://github.com/rdmolony/django-timescaledb-example)

If successful, you should see `Django` running on [`http://localhost:8000`](http://localhost:8000)

> If you had trouble getting setup,  ask a question at [django-timescaledb-example/discussions](https://github.com/rdmolony/django-timescaledb-example/discussions)


---


## Getting data in

In my case all of the timeseries data originated from text files.  How do I copy data from files into `TimescaleDB`?

As of 2023-12-18, the `Django` documentation covers [File Uploads](https://docs.djangoproject.com/en/5.0/topics/http/file-uploads/), however, it doesn't advise on importing file contents to a database (I suspect) since this isn't a typical use case.  One normally uses `Django` to add save new entries to `Postgres` using input from a browser:

- `Django` sends a web page to a browser containing one or more `<form>` elements
- Once filled-in, these `<form>` elements are sent back to `Django`
- `Django` processes these entries using & saves them to the database using the `Django` ORM

> If any of this sounds unfamiliar to you,  consider completing out the ["Official Django Tutorial"](https://docs.djangoproject.com/en/5.0/intro/tutorial01/) before continuing on here

ORM stands for "Object Relational Mapper".  It maps a `Python` class to a database table so that this table's data is easily accessible from within `Python`.  Without an ORM one would have to use the `SQL` language to communicate with the database.

Let's say I want to store my timeseries readings in the `sensor_reading` table.  I can create a model in `models.py` like ...

```python
from django.db import models

class SensorReading(models.Model):
    sensor_name = models.TextField()
    reading = models.FloatField()

    class Meta:
        db_name = "sensor_reading"
```

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
