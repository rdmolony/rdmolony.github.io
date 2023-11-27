---
title: "Struggling to sync sensors & databases"
layout: post
---

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
  - [How logger files **were imported** to a database](#how-logger-files-were-imported-to-a-database)
  - [How sensor readings **were cleaned**](#how-sensor-readings-were-cleaned)
  - [How sensor readings **were accessed**](#how-sensor-readings-were-accessed)
- [The "new" way -](#the-new-way--)
  - [How files **are now fetched** remote sensors](#how-files-are-now-fetched-remote-sensors)
  - [How sensor files **are now imported** to a database](#how-sensor-files-are-now-imported-to-a-database)
  - [How sensor readings **are now cleaned**](#how-sensor-readings-are-now-cleaned)
  - [How sensor readings **are now accessed**](#how-sensor-readings-are-now-accessed)
- [Footnotes](#footnotes)


---
<br>


# Getting started

It took me 2-3 months before I was "comfortable" to make a code change -

- The server crashed multiple times a week
- I couldn't run the code on my laptop because I didn't have a local developer environment
- Not all dependencies (`Python` & non-`Python` 3rd party libraries) in use were documented
- The code was untested[^CAO]
- I didn't know the `Python` web framework in which the web application was written (`Django`)
- I didn't know anything about relational databases which the web application relies on to store data

[^CAO]: Software tests check that code does what it was designed to do.  They provides software engineers with guard-rails, since if an aspect of a system is well tested then you might find out if your change breaks something before you roll it out.

First up the crashes.

It turns out that the web application was crashing because it was running on `Command Prompt` on a `Windows Virtual Machine` [in which `Quick-Edit Mode` was enabled](https://stackoverflow.com/questions/30418886/how-and-why-does-quickedit-mode-in-command-prompt-freeze-applications) (the default behaviour).  I turned it off & bingo, no more crashes.

I managed to setup a reproducible developer environment on my laptop,  using `poetry`[^KOO] for `Python` & `Docker Compose`[^KAA] for everything else like databases & non-`Python` libraries.

> Later when `Docker` refused to run on my machine due to "networking" issues,  I was forced to rebuild this developer environment in `nix` via [`devenv.sh`](https://devenv.sh/).

[^KOO]: `poetry` is a `Python` library for tracking & managing other 3rd party `Python` libraries.  Sometimes `Python` libraries depend on non-`Python` libraries, which `poetry` by design cannot manage, so one has to resort to something like `Docker` (or `conda` or `nix`)

[^KAA]: `Docker` lets you define an operating system in a configuration file, it can then spin this up in the background & launch your code in it.  If you share the configuration with others they can use it to spin up the same operating system as you.  `Docker Compose` lets you define configuration file in which multiple systems are defined, typically a database & an operating system.  It will spin up all of these systems & link them to one another.

With my new superpower I could now change things.  And so I did.  And something broke.  And so I patched it.  And something broke.

Under pressure to fix bugs, I made changes without first covering the system in tests[^QIO],  and I suffered for it.

So I paused all code changes and set about testing the most common usage scenarios.

I scripted a bot to replicate these scenarios by clicking through a browser via `Selenium`, and I automated running this bot automatically before any code change could be accepted via `GitHub Actions`[^PUD] which thanks to the `Docker`[^KAA] work was relatively straightforward.

[^PUD]: `GitHub Actions` lets you define a configuration file which specifies actions (`bash` commands) to run in scenarios like "on receiving proposals for code changes"

I was now somewhat happier to make changes to the web application.

I was still scared, however, to touch the data pipeline - the `Python` glue that transformed raw data into useful file outputs.  I was scared because I couldn't easily test it so I couldn't be sure that my changes wouldn't break things.  Why?

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

These jobs need to be run periodically.  So a `batchfile` specifying the `Python` jobs was scheduled in `Task Scheduler` on the same server as `LoggerNet`.


---
<br>


## How logger files **were imported** to a database


![loggernet-server-to-mssql-database.svg](/assets/images/2023-11-16-stationmanager/loggernet-server-to-mssql-database.svg)


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

`LNDB` knows what type of file it has to deal with since all files are `Campbell Scientific`.  The other manufacturers each have their own conventions.  So the `Python` job had to adapt its database importer to the conventions of each type of logger.  It also tracked which files have been imported & which have not in the "metadata" database.

> [`IEA Task 43`](https://github.com/IEA-Task-43/digital_wra_data_standard) is worth a mention here.  This valiant cross-organisational team is pushing to standardise data exchange so help relieve this particular burden.


---
<br>


## How sensor readings **were cleaned**

By default all of the loggers store sensor readings in generic calibration, so each reading needs to be re-calibrated using its specific calibration before it can be used in analysis.

> An anemometer measures wind speeds by counting the number of rotations per second or frequency of its spinning cups.  To convert frequency to wind speed we need to know an anemometer's calibration[^XAR].

[^XAR]:  Calibrations are measured in a wind tunnel.  If one blows wind over an anemometer for various wind speeds & measures the number of rotations for each then one can infer it.  Specifically, calibrations are the values for slope, `m`, and offset, `c`, in `f(x) = mx + c` where `x` refers to frequency &  `f(x)` to wind speed


![anemometer.svg](/assets/images/icons/anemometer.svg){: width="100" }


Also, sometimes there are issues with a sensor, so its readings are not valid & need to be removed.

How to re-calibrate & clean millions of readings?

This one's a bit hairy.


![mssql-database-to-useful-files.svg](/assets/images/2023-11-16-stationmanager/mssql-database-to-useful-files.svg)


`Task Scheduler` periodically runs a `batchfile` which specifies a `Python` job to generate a "clean" file of sensor readings for each operational station -

- `pandas` asks the "sensor metadata" database for connection strings to the "readings" database, sensor metadata & user-specified erroneous reading timestamps via `Django` (powered by `mysqlclient`)
- `pandas` asks the "timeseries" database for readings via `SQLAlchemy` (powered by `pyodbc` & `ODBC Driver for SQL Server 17`)
- If specified, `pandas` caches readings to a `pickle` file to skip trips to the timeseries database
- `pandas` re-calibrates sensor readings & filters out erroneous ones using rules & user-specified "flags"

This is all glued together by a magic `Python` class called `StationRaw`.

I found it next to impossible to fully test this glue.   I had some success using "mocking" to replace aspects of this data flow with dummy data, so I rolled out some fairly inadequate tests and moved on.


---
<br>


## How sensor readings **were accessed**


Now for the "visible" part, the web application -

![useful-files-to-user-directly.svg](/assets/images/2023-11-16-stationmanager/useful-files-to-user-directly.svg)

If the people want to access or update data for a particular source,  they can search for the source in the web application & from there they can -

- Access "useful" timeseries files of sensor readings
- Change the calibrations for a particular source's sensor
- Flag erroneous readings graphically
- Manually refresh a "useful" export file

The web application is built using the `Django` web framework.

For most requests to the web application it doesn't need to do much work -

- To display a web page it asks the database for the data it needs to display it (`HTML`, `CSS` & `JavaScript`) & enriches them with this data
- To serve "static" files like images or `csv` text files it shares them directly via `NGINX`

Refreshing a "useful" file of sensor readings requires much more time to run.

When I first joined this team one had to wait however long it took (30 seconds to 5 minutes) to generate this file.

So I created a periodic `Python` job to pre-generate these "useful" files for users, so this wait time could be skipped -


![useful-files-to-user-via-database-entry.svg](/assets/images/2023-11-16-stationmanager/useful-files-to-user-via-database-entry.svg)

One could click a "Manual Refresh" button to save a "flag" to the database marking the file to be re-generated the next time a job was run.  This job could only process one file at a time.


---
<br>


# The "new" way -


## How files **are now fetched** remote sensors

![sensors-to-loggernet-server.svg](/assets/images/2023-11-16-stationmanager/sensors-to-loggernet-server.svg)

There wasn't much more to be done here other than some housekeeping[^RAA] since the loggers are configured on-site to use either `LoggerNet` or the `SmartGrid` connection.

[^RAA]:  Credentials & file paths[^XOO] were hard-coded into the `Python` job so I pulled them into a `TOML` file to make them easier to edit.  I also adapted the scripts into notebooks, Each notebook does one thing (unzipping, decrypting, file syncing), to make them easier to read & edit


---
<br>


## How sensor files **are now imported** to a database

Now for some heftier changes.

Here's something that wasn't obvious to me at first -

How data is stored can introduce a lot of [**accidental complexity**](https://en.wikipedia.org/wiki/No_Silver_Bullet) to a system.

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

How do I find all wind speed readings?  Each column name column name corresonds to a height, magnetic orientation and a type of reading, so I first need to know what each column means.

How do I link "metadata" to each column?  Not easily.

In `Python` I can hold both separately and join them when required -

> Please feel free to skip the `Python` & scroll down!

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

But what if the readings were instead standardised before storing them so one could instead create **a single table of all sources** like ...

| timestamp | sensor_id | value |
| --- | --- | --- |
| value | Wind Speed 10m 180deg | value |

... where `sensor_id` corresponds to the column name.

Now how do I find all wind speed readings?  

Easy.  I can now join the readings to their metadata in `SQL` ...

| timestamp | sensor_id | value | data_type | height | magnetic_orientation |
| --- | --- | --- | --- | --- | --- |
| 2023-11-27 00:00:00 | 1 | 5 | "Wind Speed" | 10 | 180 |
| 2023-11-27 00:00:00 | 2 | 60 | "Wind Direction" | 10 | 180 |
| 2023-11-27 00:00:00 | 3 | 4 | "Wind Speed" | 10 | 180 |
| 2023-11-27 00:00:00 | 3 | 70 | "Wind Direction" | 10 | 180 |

... and just select "Wind Speed" readings or whatever else I might require.


> I owe this insight to Hadley Wickham's concept of ["Tidy Data"](https://vita.had.co.nz/papers/tidy-data.pdf)


Won't this be really slow to store & query since the table will contain **a lot**[^YAT] of readings?

[^YAT]: Typically each logger records average, standard deviation, minimum & maximum values every 10 minutes for each sensor.  If a logger linked to 20 sensors records for 6 years, then it will be produce `20 sensors * 4 reading types * 6 readings/hour * 24 hours * 365 days * 6 years = 25,228,800 readings`.

Yes.  In a traditional relational database like  `Microsoft SQL Server`, `Postgres` or `MySQL` it will be,  since these databases are designed to store & query new entries row by row.

But what about timeseries databases?

`TimescaleDB` is a `Postgres` extension that enables working with timeseries readings from within `Postgres`[^NAT].  It provides a special table called a `Hypertable` which speeds up insert & query performance for timeseries tables[^CAT].  So provided that its performance was comparable to `Python` I saw it as a viable alternative.

[^NAT]: It's a very popular database, see [StackOverFlow's 2023 Developer Survey](https://survey.stackoverflow.co/2023/#section-most-popular-technologies-databases)

[^CAT]: As of 2023-11-20 `TimescaleDB` by default chunks readings in compressed hypertables into intervals of one week so `Postgres` doesn't need to read all rows for queries that only care about a particular period of time, see [Hypertables](https://docs.timescale.com/use-timescale/latest/hypertables/)

The web application needs a database so the database is a hard requirement.  The web application framework, `Django`, works well with `Postgres` so by switching to `TimescaleDB` I found I could store all sensor metadata & all timeseries in the same database.

So two databases ...


![loggernet-server-to-mssql-database.svg](/assets/images/2023-11-16-stationmanager/loggernet-server-to-mssql-database.svg)


... became one ...


![loggernet-server-to-timescale-database.svg](/assets/images/2023-11-16-stationmanager/loggernet-server-to-timescale-database.svg)


Now this didn't come for free -

- I had to figure out how to make the database go fast for importing & querying data.  
- I needed a more intelligent importer since now all data needs to be transformed into the right format before storing it,  and this process depends on the source.

Having said that,  I figured it was worth the cost (see next section)


---
<br>


## How sensor readings **are now cleaned**


![timescale-database-to-useful-files.svg](/assets/images/2023-11-16-stationmanager/timescale-database-to-useful-files.svg)


Now that all readings were stored in a single table in a workable format, I could link each sensor reading with its corresponding metadata, re-calibrate and filter out erroneous readings in only a few lines of `SQL`.

What was not so straightforward, however, was making file exports fast -

- Big queries can be slow.  Asking a database for millions of readings can be slow since - unlike `pandas` - databases read from disk as well as memory
- Reformatting query results in `SQL` is hard, so I decided to query in batches & stream each batch through `Python` to reformat

> Ideally I would reformat readings (from one reading per row to one column per sensor) in `Postgres` to avoid the `Python` performance hit, however, I just found it too hard.  `Postgres` has `crosstab`, but it didn't "fit" this use case (dynamic crosstabulations).  Exporting to formats other than plain text files such as `zip` is also not well supported.

How to speed up queries?

If you don't have the right indexes for your query will be slow.  After a lot of pain,  I managed to find appropriate indexes by wrapping queries in `EXPLAIN ANALYSE` & experimenting.  `TimescaleDB` have [great resources on this topic](
https://www.timescale.com/blog/use-composite-indexes-to-speed-up-time-series-queries-sql-8ca2df6b3aaa/
)

How about exporting multiple sources in parallel?

Previously each source was processed one by one & only two "useful" output files were generated per source.  After switching over it soon became to export ten per source.  How to parallelise?

I found that I could use a task queue to run multiple queries at once.

> A task queue works like a restaurant.  The waiters add an order to the queue & the chefs pull orders from the queue when they have time to process it.

Managing database & task worker resource usage is hard.

Estimating the appropriate number of workers for the task queue is somewhat of a fine art.  I experimented with various numbers of "threads" & "processes" & queued the most CPU & RAM intensive tasks while watching resource usage to come up guess numbers.

How much CPU or RAM is too much?  Should minimising CPU or RAM be prioritised?

How to keep the number of `Postgres` connections under control?

Each worker runs a big database query, which may or may not leverage `Postgres` parallel workers such that one connection can become multiple.  I ran into trouble when my task queue workers exhausted the `Postgres` connection pool which caused the connected web application to crash.

I worked out that I could limit the number of connections by routing my `Postgres` connection through a connection pool via `PgBouncer`, which forces reusing connections rather than spinning up new ones.

`Postgres` may still spin up parallel workers if the query planner decides this is necessary.  So I had to experiment with `max_parallel_workers_per_gather` & `max_parallel_workers` in `postgresql.conf` to prevent these types of crashes.


 since I no longer needed to worry about -

- Gluing databases together
- Running out of memory - I'm looking at you `pandas`
- Testing the system end-to-end - it's easy to switch out a single database with a "test" database

---
<br>


## How sensor readings **are now accessed**



Now once again for the "visible" part, the web application -

![useful-files-to-user-via-task-queue.svg](/assets/images/2023-11-16-stationmanager/useful-files-to-user-via-task-queue.svg)

If the people want to access or update data for a particular source,  they can search for the source in the web application & from there they can -

- Access "useful" timeseries files of sensor readings
- Change the calibrations for a particular source's sensor
- Flag erroneous readings graphically
- Manually refresh a "useful" export file

The web application is built using the `Django` web framework.

For most requests to the web application it doesn't need to do much work.  To display a requested web page It merely has to either ask the database for the data it needs to display the web page they have asked for (`HTML`, `CSS` & `JavaScript`) or `NGINX` for files.

For long-running requests like refreshing a file export,  a task queue is used.

> A task queue works like a restaurant.  The waiters add an order to the queue & the chefs pull orders from the queue when they have time to process it.



Their request is added to the task queue which is then processed by a worker when it has time to do so.  They might wish to do so if the calibrations of a station have changed or if a new "flags" marking erroneous readings have been added more recently than the most recent source cache.


---
<br>


# Footnotes
