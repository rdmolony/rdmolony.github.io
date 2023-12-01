---
title: "Struggling to sync sensors & databases"
layout: post
---

> **TL;DR;** For the last two years I have maintained a system which fetches readings from remote sensors, cleans them & exports them into files that can be used to answer questions like "where to place wind turbines on on a particular site".  By standardising & storing readings in a timeseries database called `TimescaleDB`, I was able to massively simplify both the system & code needed to process them.  Making `TimescaleDB` work well with `Django` was not straightforward but was ultimately worth the effort for the reduction in system complexity it enabled.

> I owe this concept of data "standardisation" to Hadley Wickham's ["Tidy Data" paper](https://vita.had.co.nz/papers/tidy-data.pdf)


Over 2022/23 I worked at `Mainstream Renewable Power` on an internal web application called `StationManager` used by the `Energy Analysis Group` -

Its job -

- Data Access[^RAB]

  [^RAB]: Sensor readings are tracked by loggers.  Loggers save readings to text files.  `StationManager` fetches these files from the remote sensors, amalgamates readings into a file format suitable for other tools & makes these files accessible via a friendly web application user interface.

- Sensor Health Monitoring[^CHI]

  [^CHI]: The team need to know if the sensors are syncing or if the sensors faulty, so meteorological station managers can go on-site & fix them if needs be.  As well as flagging data quality automatically, it provides a user interface for manually flagging erroneous readings.

- Exploratory data analysis[^FOO]
  
  [^FOO]: In cases where a particular analysis is not yet well served by 3rd party tooling,  the team uses a shared `Jupyter Notebook` server to explore & visualise data in `Python`


Its core value lies in fetching files from remote sensors, transforming them into useful file outputs[^CIE] -

[^CIE]: in most cases a `Windographer` file, a 3rd party tool used to analyze & visualize wind resource data

![sensors-to-useful-files.svg](/assets/images/2023-11-16-stationmanager/sensors-to-useful-files.svg)


Over 2014/15 a brave individual (Paul Hughes) pulled the bulk of a system together.  It then passed through the hands of three more people (Sean Hayes, Andrew McGregor & Tomasz Jama-Lipa) before reaching me,  with each person adding their own twist to keep it alive & make it useful.

After a year of struggling to keep the show on the road,  I spent a year rebuilding its foundations -

- I brought an untested data pipeline under test[^QIO]
- I merged five ways of getting data into the system into one
- I merged two databases with one
- I replaced ~25,000 lines of code with ~1,000 lines

[^QIO]: Test code that checks that other code does what it was designed to do.  There were no tests to checking the code ingesting, transforming & saving data **because the system was too hard to test**.

So how did it work?  And what did I do differently?


> I want to thank my manager of the last two years Romain Molins without whose backing none of this would have been possible.


- [Getting started](#getting-started)
- [The "old" way -](#the-old-way--)
  - [How files **were fetched** from remote loggers](#how-files-were-fetched-from-remote-loggers)
  - [How source files **were imported** to a database](#how-source-files-were-imported-to-a-database)
  - [How sensor readings **were cleaned**](#how-sensor-readings-were-cleaned)
  - [How sensor readings **were accessed**](#how-sensor-readings-were-accessed)
- [The "new" way -](#the-new-way--)
  - [How files **are now fetched** remote sensors](#how-files-are-now-fetched-remote-sensors)
  - [How source files **are now imported** to a database](#how-source-files-are-now-imported-to-a-database)
  - [How sensor readings **are now cleaned**](#how-sensor-readings-are-now-cleaned)
  - [How sensor readings **are now accessed**](#how-sensor-readings-are-now-accessed)
- [Closing Remarks](#closing-remarks)
- [Footnotes](#footnotes)


---
<br>


# Getting started

It took me 2-3 months before I was "comfortable" to make a code change -

- The server crashed multiple times a week
- The code was untested[^CAO]
- I couldn't run the code on my laptop because I didn't have a local developer environment
- Not all dependencies (`Python` & non-`Python` 3rd party libraries) in use were documented
- I had never used the `Python` web framework in which the web application was written (`Django`) or anything similar
- I didn't know anything about relational databases; which the web application relies on to store data

[^CAO]: Software tests check that code does what it was designed to do.  They provides software engineers with guard-rails, since if an aspect of a system is well tested then you might find out if your change breaks something before you roll it out.

First up the crashes.

It turns out that the web application was crashing because it was running on `Command Prompt` on a `Windows Virtual Machine` [in which `Quick-Edit Mode` was enabled](https://stackoverflow.com/questions/30418886/how-and-why-does-quickedit-mode-in-command-prompt-freeze-applications) (the default behaviour).  On Romain's hunch, I turned it off & bingo, no more crashes.

I managed to setup a reproducible developer environment on my laptop,  using `poetry`[^KOO] for `Python` & `Docker Compose`[^KAA] for everything else (like databases & non-`Python` libraries).

> Later when `Docker` refused to run on my machine due to "networking" issues,  I was forced to rebuild this developer environment in `nix` via [`devenv.sh`](https://devenv.sh/).

[^KOO]: `poetry` is a `Python` library for tracking & managing other 3rd party `Python` libraries.  Sometimes `Python` libraries depend on non-`Python` libraries, which `poetry` by design cannot manage, so one has to resort to something like `Docker` (or `conda` or `nix`)

[^KAA]: `Docker` lets you define an operating system in a configuration file, it can then spin this up in the background & launch your code in it.  If you share the configuration with others they can use it to spin up the same operating system as you.  `Docker Compose` lets you define configuration file in which multiple systems are defined, typically a database & an operating system.  It will spin up all of these systems & link them to one another.

With my new superpower I could now change things.  And so I did.  And something broke.  And so I patched it.  And something broke.

Under pressure to fix bugs, I made changes without first covering the system in tests[^QIO],  and I suffered for it.  So I paused all code changes and set about testing the most common usage scenarios.

I scripted a bot to replicate these scenarios by clicking through a browser via `Selenium`, and I automated running this bot automatically before any code change could be accepted via `GitHub Actions`[^PUD] which thanks to the `Docker`[^KAA] work was relatively straightforward.

[^PUD]: `GitHub Actions` lets you define a configuration file which specifies actions (`bash` commands) to run in scenarios like "on receiving proposals for code changes"

I was now somewhat happier to make changes to the web application.

I was still scared, however, to touch the data pipeline - the `Python` glue that transformed raw data into useful file outputs.  I was scared because I couldn't easily test it, so I couldn't be sure that my changes wouldn't break things.  Why?

This web application depends on a database, so before testing a particular thing one has to -

- Replace the database with a "test" database
- Write to the "test" database all data that is required for the thing to work

This is "okay" to do & well documented online since it's standard practice.

The pipeline, however, depended on two different databases (`MySQL` & `Microsoft SQL Server`) on two different servers and on "cache"[^ROL] files -

[^ROL]: If something takes a long time to run & is run multiple times, it is common to cache it to a file or a database & use the cache to skip reruns


![mssql-database-to-useful-files.svg](/assets/images/2023-11-16-stationmanager/mssql-database-to-useful-files.svg)


I couldn't for the life of me work out how to replace the second database with a "test" database to test this "glue" code (discussed later).

And this "glue" code was only the tip of the iceberg.

It was the job of a collection of different tools to fetch sensor readings from remote loggers & import these files to the "timeseries" database,  any of which going wrong caused issues downstream.  So for a year I (mostly) avoided touching this.

And there certainly were problems.

In one case, a tool that fetches files of sensor readings from remote sensors (`LoggerNet`) went down for a few days.  Upon restoring it we noticed that the "readings" database was missing a few days of readings, and the tool that imports these files to this database (`LNDB`) refused to backfill these missing readings.  So I had to manually import each file for each gap.

In another case,  I attempted to update `pandas`, a 3rd party `Python` library used to "glue" the pipeline together, to the latest version.  This update resulted in invalid sensor readings being exported from the system to analysts.  It took us a few weeks to notice & luckily had no impact, but was stressful nonetheless.

If something doesn't work,  this team can't do their job.  So when I was finally confident that I could rebuild the data pipeline more cleanly on top of better foundations,  I did.


---
<br>


# The "old" way -


## How files **were fetched** from remote loggers


![sensors-to-loggernet-server.svg](/assets/images/2023-11-16-stationmanager/sensors-to-loggernet-server.svg)


To fetch files from remote sensors manufactured by `Campbell Scientific`,  it's quite straightforward[^RAT] ...

[^RAT]: At least from a software engineer's perspective, installing loggers & configuring `LoggerNet` is not something I have experience with

- Install their `LoggerNet` software on a `Microsoft Windows` server
- Configure the remote sensors (or "loggers") in `LoggerNet`

... & tada, the files are fetched & saved to this `Microsoft Windows` server.

But what about the non-`Campbell Scientific` loggers?

An equivalent tool was custom built in `Python` -

Remote sensors are normally in deserts so connecting to them is not cheap or easy.  So a 3rd party, [`SmartGrid Technologies`](https://www.igrid.co.za/), was hired to sync files from the loggers to their cloud-based filesystem.  These files still need to be synced from there to the same place as the `LoggerNet` files so a `Python` job was created to do so.

These files are normally compressed & encrypted.  So another `Python` job was created to automatically unzip them (via `7zip`) & decrypt them (via `ZPH2CSV.exe`) where relevant.

These jobs need to be run periodically.  So a `batchfile` specifying the `Python` jobs was scheduled in `Task Scheduler` on the same server as the web application.


---
<br>


## How source files **were imported** to a database


![source-files-to-mssql-database.svg](/assets/images/2023-11-16-stationmanager/source-files-to-mssql-database.svg)


Most logger files only contain readings for at most a few days,  so all files associated with a particular logger need to be amalgamated.

`Campbell Scientific` provide an application called `LNDB` which automatically exports logger readings to database tables.  Each database table contains all readings for a particular logger & looks like ...

| timestamp | sensor_name_1 | ... | sensor_name_n |
| --- | --- | --- | --- |
| value | value | ... | value |

Again, what about the other loggers?

Again, a custom equivalent was built in `Python` -

Reading text files & importing them to a database table is surprisingly hard -

- How is it encoded?
- Are the first few lines metadata?
- What columns represent timestamps?  How are they formatted?
- Are there columns in the file that are not reflected in the database table?  If so,  the database table must be updated!

`LNDB` knows what type of file it has to deal with since all files are `Campbell Scientific`.  The other manufacturers each have their own conventions.

So the `Python` job had to adapt its database importer to the conventions of each type of logger.

It also tracked which files have been imported & which have not in the "metadata" database" which is linked to the web application, so this import status was "viewable" by the team.

> [`IEA Task 43`](https://github.com/IEA-Task-43/digital_wra_data_standard) is worth a mention here.  This valiant cross-organisational team is pushing to standardise data exchange to help relieve this particular burden.

How about importing multiple files at the same time?  The team used a "Task Queue" ...

> A task queue works like a restaurant.  The waiters add an order to the queue & the chefs pull orders from the queue when they have time to process it.

... to queue import jobs and process these jobs using as many workers as available.

> In practice,  the task queue `huey` didn't actually run tasks in parallel as this wasn't well supported on either `Windows` or the task queue database `sqlite`. It only ran one job at a time.

Finally, the importer also handled files uploaded directly to the file server.  To do so the team would have to ...

- Connect to the Virtual Private Network (VPN)
- Map this remote file server as a network drive
- Copy & paste across

... and since mapped network drives didn't allow granting  "write access" without also granting "delete access" it was very possible that someone could **accidentally delete everything**.


---
<br>


## How sensor readings **were cleaned**

By default all of the loggers are setup on-site using generic settings typical for that logger manufacturer.  Before these readings can be used the readings need to be "re-calibrated"[^XAR] using settings that are specific to particular settings.  If sensor readings are not re-calibrated using the correct settings then the readings will be off & the analysis relying on them will be wrong.

[^XAR]: Wind speed is typically measured by an anemometer.  It counts the number of rotations per second (or frequency) of its spinning cups.  To convert these rotations to wind speed one needs to know an anemometer's "calibrations" which are measured in a wind tunnel.  Mathematically, "calibrations" refer to the slope, `m`, and offset, `c`, in `f(x) = mx + c` where `x` refers to frequency &  `f(x)` to wind speed.

Sometimes there are issues with a sensor.  If it requires replacement, it takes time to go on-site and do so.  The values recorded in the interim will be wrong, so they need to be filtered out.

How to re-calibrate & clean millions of readings?

This one's a bit hairy.


![mssql-database-to-useful-files.svg](/assets/images/2023-11-16-stationmanager/mssql-database-to-useful-files.svg)


A `Python` job was created to generate a "clean" file of sensor readings for each source - 

> `pandas` is an open source data analysis and manipulation tool, built on top of the `Python` programming language.

- `pandas` asks the "sensor metadata" database for sensor metadata (calibrations, type of data measured ...), connection strings to the "readings" database, & user-specified timestamps of erroneous readings via `Django` (powered by `mysqlclient`)
- `pandas` asks the "timeseries" database for sensor readings via `SQLAlchemy` (powered by `pyodbc` & `ODBC Driver for SQL Server 17`)
- If specified, `pandas` caches readings to a `pickle` file to skip round trips to the timeseries database
- `pandas` re-calibrates sensor readings & filters out erroneous ones using rules & user-specified timestamps of erroneous readings

This is all glued together by a magic `Python` class called `StationRaw`.  It hides this complexity behind a friendly interface.

I found it next to impossible to fully test this glue.   After a lot of effort, I had only managed to test aspects of this data flow by using "mocking" to replace "timeseries" database with dummy data, so I rolled these out and moved on.


---
<br>


## How sensor readings **were accessed**


Now for the "visible" parts -

![useful-files-to-user-directly.svg](/assets/images/2023-11-16-stationmanager/useful-files-to-user-directly.svg)

Data was accessed from either the web application (built using the `Django` web framework), or from a `Jupyter Notebook` server.

In both cases every time someone wanted to access data for a particular source it was generated on demand, so they had to wait however long it took for the `Python` "glue" to pull everything together.

> For usage not related to data access the web application didn't need to do much work since these scenarios were well served by `Django` -
>- To display a web page it asks a database for the data it needs to render files that the browser needs (`HTML`, `CSS` & `JavaScript`) so it can display a user interface
>- To serve "static" files like images or `csv` text files it can just send them directly (typically by routing to another tool like `NGINX` or `Apache`)

The web application enabled configuring the data pipeline to change the exported data sets.  One could flag erroneous readings graphically so that they would be filtered out, or change a particular sensor's settings so its readings would be shifted.

Back in 2014/15 there was a push internally to do all energy analysis in `Python` in `Jupyter Notebooks` ...

> `Jupyter Notebook` is a web-based interactive computing platform

... however, by the time I started, these notebooks had been largely phased out in favour of dedicated tooling like `Windographer`, and were only used for scenarios not yet covered by such tooling.

To make the lives of the team easier,  they could access and run the notebooks from their browser over a Virtual Private Network (VPN) connection without having to install anything.

Since the notebooks relied on the "glue" and the "glue" relied on `Django`, the notebooks shared their environment with the web application.  So if someone tried `!pip install X` they **broke the web application**, or `!del /S C:\*` they **wiped the server**.  If they ran a notebook that uses a lot of RAM or CPU or if multiple people forgot to close their notebooks then the server's resources would run out and the **web application would break**.  Silly things like database or dependency changes or `Django` settings broke the notebook server.

If any step in the data pipeline broke or went down (for whatever reason) then data access failed,  and someone would have to work out where and why.


---
<br>


# The "new" way -


## How files **are now fetched** remote sensors

![sensors-to-loggernet-server.svg](/assets/images/2023-11-16-stationmanager/sensors-to-loggernet-server.svg)

There wasn't much more to be done here other than some housekeeping[^RAA] since the loggers are configured on-site to use either `LoggerNet` or the `SmartGrid` connection.

[^RAA]:  Credentials & file paths were hard-coded into the `Python` job so I pulled them into a `TOML` file to make them easier to edit.  I also adapted the scripts into notebooks, Each notebook does one thing (unzipping, decrypting, file syncing), to make them easier to read & edit


---
<br>


## How source files **are now imported** to a database

Now for some heftier changes.

Sensor readings were stored in one database, sensor metadata in another, and data was processed in `Python`.  The web application needs a database, so why not also use the same database for storing timeseries?

If all data is stored in one database, then why not ask the database to process readings instead of using `Python`?

How data is stored can introduce a lot of [**accidental complexity**](https://en.wikipedia.org/wiki/No_Silver_Bullet)!

Let's say we have two database tables corresponding to two different loggers ...

| timestamp | Wind Speed 10m 180deg | Wind Direction 10m 180deg |
| --- | --- | --- |
| 2023-11-27 00:00:00 | 5 | 60 |
| ... | ... | ... |

... for one and ...

| timestamp | WS10.180 | WD10.180 |
| --- | --- | --- |
| 2023-11-27 00:00:00 | 4 | 70 |
| ... | ... | ... |

... for another.

Clearly both `Wind Speed 10m 180deg` and `WS10.180` mean the same thing but to a computer its not so clear.

How do I find all wind speed readings?  Each column name corresponds to a height, magnetic orientation and a type of reading, so I first need to know what each column means.

How do I link "metadata" to each column?

I can't easily express this in the database language `SQL` so it's hard to link at the database level.

`Python` is much more flexible, and so I can import the database data so I can hold both separately and join them as required like ...

```python
{
  "source_1":  {
    "timeseries": {
      "timestamp" ["2023-11-27 00:00:00", ...],
      "Wind Speed 10m 180deg": [5, ...],
      "Wind Direction 10m 180deg": [60, ...],
    },
    "metadata": {
      "Wind Speed 10m 180deg": {
        "data_type": "Wind Speed",
        "magnetic_orientation": 180
        "height": 10,
      },
      "Wind Direction 10m 180deg": {
        "data_type": "Wind Direction",
        "magnetic_orientation": 180
        "height": 10,
      },
    }
  },
  "source_2":  {
    "timeseries": {
      "timestamp" ["2023-11-27 00:00:00", ...],
      "WS10.180": [4, ...],
      "WD10.180": [70, ...],
    },
    "metadata": {
      "WS10.180": {
        "data_type": "Wind Speed",
        "magnetic_orientation": 180
        "height": 10,
      },
      "WD10.180": {
        "data_type": "Wind Direction",
        "magnetic_orientation": 180
        "height": 10,
      },
    }
  }
}
```

... albeit in a rather complex manner.

But what if the readings were instead standardised before storing them so one could instead create **a single table of all sources**?

Now how do I find all wind speed readings?  

Easy.  I can now don't need to resort to `Python` since I can now join readings to their metadata in the database on matching sensor names -

So ...

| timestamp | sensor_id | value |
| --- | --- | --- | --- | --- | --- |
| 2023-11-27 00:00:00 | 1 | 5 |
| 2023-11-27 00:00:00 | 2 | 60 |
| 2023-11-27 00:00:00 | 3 | 4 |
| 2023-11-27 00:00:00 | 4 | 70 |

... joins with ...

| sensor_id | data_type | height | magnetic_orientation |
| --- | --- | --- | --- | --- | --- |
| 1 | "Wind Speed" | 1 | 5 |
| 2 | "Wind Direction" | 2 | 60 |
| 3 | "Wind Speed" | 3 | 4 |
| 4 | "Wind Direction" |3 | 70 |

... on matching `sensor_id` to form ...

| timestamp | sensor_id | value | data_type | height | magnetic_orientation |
| --- | --- | --- | --- | --- | --- |
| 2023-11-27 00:00:00 | 1 | 5 | "Wind Speed" | 10 | 180 |
| 2023-11-27 00:00:00 | 2 | 60 | "Wind Direction" | 10 | 180 |
| 2023-11-27 00:00:00 | 3 | 4 | "Wind Speed" | 10 | 180 |
| 2023-11-27 00:00:00 | 3 | 70 | "Wind Direction" | 10 | 180 |

... from which I can now filter on "Wind Speed" or do whatever else I might require.

But won't timeseries readings be really slow to store & query since the table will contain **a lot**[^YAT] of readings?

[^YAT]: Typically each logger records average, standard deviation, minimum & maximum values every 10 minutes for each sensor.  If a logger linked to 20 sensors records for 6 years, then it will be produce `20 sensors * 4 reading types * 6 readings/hour * 24 hours * 365 days * 6 years = 25,228,800 readings`.

Yes.  In a traditional relational database like  `Microsoft SQL Server`, `Postgres` or `MySQL` it will be,  since these databases are designed to store & query new entries row by row.

But what about timeseries databases?

`TimescaleDB` is a extension that enables working with timeseries readings from within the `Postgres`[^NAT] database.  It provides a special table called a `Hypertable` which speeds up insert & query performance for timeseries tables[^CAT].  So provided that its performance was comparable to `Python` I saw it as a viable alternative.

[^NAT]: It's a very popular database, see [StackOverFlow's 2023 Developer Survey](https://survey.stackoverflow.co/2023/#section-most-popular-technologies-databases)

[^CAT]: As of 2023-11-20 `TimescaleDB` by default chunks readings in compressed hypertables into intervals of one week so `Postgres` doesn't need to read all rows for queries that only care about a particular period of time, see [Hypertables](https://docs.timescale.com/use-timescale/latest/hypertables/)

The web application framework, `Django`, works well with `Postgres` so by switching to `TimescaleDB` I found I could store all sensor metadata & all timeseries in the same database.

So three databases ...


![source-files-to-mssql-database.svg](/assets/images/2023-11-16-stationmanager/source-files-to-mssql-database.svg)


... became, well, two databases ...


![source-files-to-timescale-database.svg](/assets/images/2023-11-16-stationmanager/source-files-to-timescale-database.svg)


Now this change didn't come for free,  I had to ...

- Build an importer on the web application to parse sensor files and import them to the `TimescaleDB` database
- Adapt the web application so it would accept sensor files sent from another program (via an "Application Programming Interface" built on `django-rest-framework`)
- Build an exporter to send files to the web application alongside their file type, since the importer needs to know what type of file it is dealing with before it can import it
- Build out a user interface on the web application to allow manually uploading files
- Rebuild the task queue on `dramatiq`[^TOT]

[^TOT]: I couldn't figure out how to use the prior task queue engine `huey` to run tasks in parallel on a `Windows` operating system.  Most task queues use `*nix` only features for parallelism so don't bother supporting it.  `Windows` has been a hard constraint on us, and can really limit tooling options.  Thankfully, `dramatiq` supports windows & proved itself to be alternative.

> Once again,  a task queue was used to run multiple file import tasks at the same time, except this time the task queue engine `dramatiq` was actually able to do this on `Windows`

Having said all that,  I figured it was worth the cost for the simplicity it enables for the next step - data cleaning.


---
<br>


## How sensor readings **are now cleaned**


![timescale-database-to-useful-files.svg](/assets/images/2023-11-16-stationmanager/timescale-database-to-useful-files.svg)


Once all readings for all sensors were stored in a single table, I could link each sensor reading to its corresponding metadata, re-calibrate and filter out erroneous readings in only a few lines of `SQL`, the database language.

What was not so straightforward, however, was exporting files in the formats that I wanted -

- Big queries can be slow.  Asking a database for millions of readings can be slow since - unlike `pandas` - databases read from disk as well as memory[^WWW].  

[^WWW]: Since they're careful with memory usage, this also means that a single database query won't use up all of a server's memory & crash it

- Reformatting query results in `SQL` is hard, so I decided to query in batches & stream each batch through `Python` to reformat

> Ideally I would have liked to reformat readings in `Postgres` (from one reading per row to one column per sensor) to avoid the `Python` performance hit, however, reformatting is suprisingly hard in `Postgres`.  I wanted to stream from `Postgres` into a `zip` file of multiple text files where each text file represents a different type of sensor (wind speed, direction etc).  I found it too difficult to express this in `SQL`.

How to speed up queries?

I found out the hard way that if you don't create appropriate indexes for your queries then they will take forever to run.  `TimescaleDB` wrote up [a very helpful blog on this topic](
https://www.timescale.com/blog/use-composite-indexes-to-speed-up-time-series-queries-sql-8ca2df6b3aaa/
).

> I managed to improve performance quite a lot by wrapping my slow queries in `EXPLAIN ANALYSE` to see whether or not they actually used the indexes I created for them.

How about exporting multiple sources in parallel?

Once again, I found that I could use a task queue to run multiple queries at once, however, this task wasn't as straightforward since exporting millions of readings to a file is very CPU & RAM intensive -

How many workers should be in the task queue?

> I found estimating the appropriate number of workers for the task queue to be somewhat of a fine art.  I experimented with various numbers while watching resource usage to guess appropriate numbers.

What if the database runs out of connections?

> The web applications and the workers both needed connections.  I ran into trouble when my task queue workers exhausted the `Postgres` connection pool which caused the connected web application to crash.  I worked out that I could limit the number of connections by routing my `Postgres` connection through a connection pool via `PgBouncer`, which forced reusing connections rather than spinning up new ones.  This helped but wasn't enough.  I found that `Postgres` was still spinning up parallel workers to answer particular queries if the query planner decided this was necessary, so only after fiddling with `max_parallel_workers_per_gather` & `max_parallel_workers` in `postgresql.conf` was I able to bring this under control.


---
<br>


## How sensor readings **are now accessed**


Now finally back to the "visible" parts -

![useful-files-to-user-via-task-queue.svg](/assets/images/2023-11-16-stationmanager/useful-files-to-user-via-task-queue.svg)

Somewhat sadly for the backend engineer, this bulk of this work is mostly "invisible" other than -

- Faster "big" requests (like refreshing a "useful" file export) since they are offloaded to a task queue which can process in parallel
- Faster data access
- Manual file uploads
- Direct access to "raw" files of sensor readings

However, the aim of this project was not to provide flashy new things, but rather to setup foundations which can be built upon for years to come.

Has this been achieved?

Only time will tell!


---
<br>


# Closing Remarks


I still had complexity,  but I no longer needed to worry about -

- Gluing databases together
- Running out of memory - I'm looking at you `pandas`
- Testing the system end-to-end

At last I was able to fully test the data flow on sample data from all of the logger manufacturers we have used so far,  so I could guarantee the behaviour of importing, processing & exporting.  Moreover,  if a new type of file comes along which the system cannot handle,  it can now be added to this "test suite" to be submitted alongside the corresponding code "patch".

The complexity was at last manageable.


---
<br>


# Footnotes
