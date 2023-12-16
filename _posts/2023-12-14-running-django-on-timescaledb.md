---
title: "Running Django on TimescaleDB"
layout: "post"
description: |
  Some thoughts on making Django & TimescaleDB play nicely
---

In [Struggling to Sync Sensors & Databases]({% post_url 2023-12-04-struggling-to-sync-sensors-and-databases %}) I reflect on rebuilding a data flow system on top of `TimescaleDB`.  I do not, however, discuss how I adapted a `Django` web application to play nicely with it.

Since `TimescaleDB` is an extension to `Postgres`,  switching to `TimescaleDB` is as easy as switching to `Postgres`.  You won't, however, see much benefit for timeseries data if you don't adapt ...

{% capture table_of_contents %}

- [Setup](#setup)
- [Getting data in](#getting-data-in)
- [Getting data out](#getting-data-out)

{% endcapture %}
{% include toc.html content=table_of_contents %}

> `TimescaleDB` is an extension to the `Postgres` database which grants it timeseries capabilities.  `Postgres` wasn't designed to handle timeseries workloads in which data is infrequently inserted and frequently queried in bulk.  `TimescaleDB` adapts `Postgres` via "hypertables" which enable compression of many rows into "chunks" which are indexed by timestamps.  Consequently,  queries on ranges of timestamps are faster since `Postgres` can search "chunks" instead of rows & storage is cheaper.  By compressing, `TimescaleDB` trades insert performance for query performance.

> `Django` is a `Python` web framework.  In my case, it served as the "glue" between web browsers and a database.  Specifically, to display a web page it asks a database for the data it needs to render files that the browser interprets (`HTML`, `CSS` & `JavaScript`) so it can display a user interface


---

# Setup

Let's 

# Getting data in

In my case all of the timeseries data originated from text files.  How do I copy data from files into `TimescaleDB`?

The `Django` documentation covers [File Uploads](https://docs.djangoproject.com/en/5.0/topics/http/file-uploads/), however, it doesn't advice on how to efficiently parse file contents & import them into the database.

To communicate from `Django` to a database,  typically one uses a `Django` "model" which maps between a database and `Django` to define table names & column names.

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

# Getting data out
