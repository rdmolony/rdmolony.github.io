---
title: "Struggling to do reproducible data analytics in Python"
layout: post
---

> TL;DR;  Learning how to do arithmetic in `pandas` wasn't hard.  Glueing together a reproducible data pipeline was.  My task wasn't rocket science, but combining `Python` tooling together felt like it.


Over 2020/21 I was at working at `Codema` on the `Dublin Region Energy Masterplan`.  

I wanted to combine several publicly available datasets to (rudimentarily) estimate Dublin energy demand & visualise some insights.  I wanted anyone to be able to run the models used & challenge the model assumptions.  I wanted the work to be the foundation of more work to come.

Our aim was to estimate energy demand in as bottom-up a manner as possible so that we could match local demand to local renewables (wind or solar) under local contraints (urban planning, electricity grid, gas grid).

The end result:  [codema-dev/projects](https://github.com/codema-dev/projects)

Achieving this in practice was hard.

Why?

- [Tools?](#tools)
- [Downloading data?](#downloading-data)
- [Wrangling data?](#wrangling-data)
- [Visualising data?](#visualising-data)
- [Gluing Python functions together?](#gluing-python-functions-together)
- [Developer environment?](#developer-environment)


---
<br>

# Tools?

The prior model had been implemented in `Excel`.  

It used a ~1GB dataset of building energy ratings as an input, which was big enough to crash `Excel`.  So the original dataset was split into multiple smaller datasets, & with the help of a plugin, these were combined together.  The model coupled data & logic,  so every time the underlying dataset was updated these manual data transformation steps were going to have to be repeated.

> What do I mean by coupling data & logic?  Say I have a sheet in `Excel` where column **A** contains `distance (m)` & column **B** contains `time (s)` & I want to find `velocity (m/s)`.  I might ...

> - Create a third column called `velocity (m/s)`
> - Specify in cell **C1** `= A1 / B1`
> - Drag & drop this cell to the same length as the prior two columns 

> ... & tada I have velocities.  What if I want to calculate `velocity (m/s)` in another workbook?  I copy across `distance (m)` & `time (s)` & repeat the same steps.

So fearing manual, repetitive work, I ruled out `Excel`.

What else could I use?

I needed something that was ... 

1. Easy to use
2. Easy to install
3. Easy to build on
4. Freely available
5. Powerful - so it could be scaled to larger datasets than we could handle in `Excel`

I landed on `Python` + `pandas` which hit 4, 5 & theoretically 3.  I had no prior `Python` experience, though I had used `C++` & `MATLAB` at a very basic level in university.

This switch didn't come for free.

`Excel` is constrained.  `Python` isn't.  

It's easy with the benefit of hindsight to see how a wealth of tooling can easily distract from the problem at hand.  How to define good enough?

- Who needs to use the code?  What is reasonable to expect from them?  How to share a cross-platform developer environment they can use?
- Do we need to "unit test" the `Python` code?  If so,  how do we run the tests on code changes?
- How to create an interactive application?  Where should it run?

> Unit tests are code that checks code does what it was designed to do

Contrast that with sharing an `Excel` spreadsheet.  It's easy to use without much prior knowledge & widely available.

Does this power justify the additional complexity?


---
<br>

# Downloading data?

We were working with several datasets -

- `Building Energy Ratings (BER) - SEAI` - hidden behind a login
- `Annual Gas Consumption - Central Statistics Office` - publicly available
- `Small Area Census Statistics - Central Statistics Office` - publicly available
- `High, Medium & Low Voltage Electricity Grid Map - ESB` - available upon request
- `Gas Grid Map - Gas Neworks Ireland` - available upon request
- `Dublin County ShapeFile - ?]` - publicly available
- [Emissions Trading Scheme (ETS) Emissions - Environmental Protection Agency]() - publicly available

If I could,  I wanted to automate all data access, but one dataset - the BER dataset - was hidden behind a login.

To automate accessing it I would have to ...

- Login using a previously validated email address
- Find a dataset link on the subsequent pages & download it using said link

Powered by `Stackoverflow`, I landed on `Selenium` - the browser automation tool - I just had to ...

1. Install a `Selenium` compatable browser
2. Install a `Selenium` driver
3. Install `Java`

... & write instructions for the browser using its `Python` API.

Somehow this `Python` API calls into `Java` which calls into the browser?!  A whole lot of complexity for such a simple task ...

I eventually figured out that I could login using the `requests` library using sessions which persists cookies.

A bit simpler.


---
<br>

# Wrangling data?

> By "wrangling" I mean loading & combining datasets

Now to process the datasets.

Surpisingly (for me), loading text files via `pandas` was hard.  I had to fiddle with various arguments to `read_csv` until I could get the damn thing to read -

- One of the datasets was around ~1GB so loading failed due to running out of memory.  Eventually I figured out how to decrease memory usage using various hacks (`chunksize`, `dtypes` etc).
- The same dataset had an error in the csv where on the 800 thousandth line or so a string isn't escaped properly, so I specified `csv.QUOTE_NONE` as `escapechar`.

A rough start.

I didn't have an off-the-shelf open-source building energy demand model to estimate energy demands from individual building characteristics like dimensions, U-values, boiler efficiencies etc,  so I wrote my own model called [`codema-dev/rc-building-model`](https://github.com/codema-dev/rc-building-model) based on the SEAI Building Energy Rating model `Excel`.

I hunted the spreadsheet calculations over several sheets using "Find Relations" & translated each `Excel` step into `Python`[^1].  Really tedious.

This let me figure out the impact of changing certain charateristics on building energy ratings which is naturally a focus of planners.  The higher the better.

I used `pandas`, `GeoPandas` & `numpy` for loading & combining datasets & doing basic arithmetic (etc) on them.

This worked fine so long as the combined datasets fit into memory!  If it didn't then I had to throw out my code & rewrite it using a distributed computing tool like `Dask` or `PySpark`,  which bring their own, different complexities[^2] ...


---
<br>

# Visualising data?

Who is the target audience & how will they interact with the data?  Will the visualisations live in `pdfs`, a desktop or web application, or `Jupyter Notebooks`?

> `Jupyter Notebook` is a `Python` application for interactive computing

`pandas` had decent visualisation capabilities baked-in via `DataFrame.plot` for scatter plots, histograms, pie charts etc,  & `GeoPandas` for maps[^3].

Baking insights into images for `pdfs` is okay.  Online interactive visualisations are better.

Without needing to know any web development I figured out how to -

- Use `bokeh` to bake fairly crude interactive maps into a static `HTML` file
- Use `streamlit` to create an interactive data explorer web application

`streamlit` was exciting.  By adding only a few lines of code it converted our `Python` functions into an interactive web application.  The company behind it also provided a free-tier hosting service that we used to deploy an interactive web application for modelling building energy demands powered by [`codema-dev/rc-building-model`](https://github.com/codema-dev/rc-building-model).

Even still,  visualisation wasn't smooth.  `pandas` could only fit the BER buildings dataset into memory on the free-tier `streamlit` server once we baked the dataset into a `parquet` file which the application accessed via `Amazon S3`.

I also tried to create a desktop application so we could use the end-user's resources to process data etc.  I got a basic application running via [chriskiehl/Gooey](https://github.com/chriskiehl/Gooey) but I found packaging & sharing it too hard to be of any use.  Sharing `Jupyter Notebook` is also hard because the end-user needs to be comfortable on the command line & may have to use it to install & run anything.


---
<br>

# Gluing Python functions together?

To make the whole process reproducible we have to automate downloading, wrangling & visualisation of the datasets.  

I started off running code using `Jupyter Notebooks` since that's [how I initially learned `pandas`](https://www.udemy.com/course/data-analysis-with-pandas/).  Bit by bit the notebook grew in size, until eventually it took a long time to run & broke on the most minor of changes.

I broke it into multiple notebooks, but then I had to figure out how to combine them.

In my struggle I found [Joel Grus - I don't like notebooks](https://www.youtube.com/watch?v=9Q6sLbz37gk) which pushed me towards `Python` functions.  

I could run a `Python` script which calls multiple functions, but that's not really very different to a giant notebook, though at least I could "unit test" the functions to help avoid regressions using `pytest`.  Now I had to learn `pytest`.  How do I run the tests on code changes?  Now `GitHub Actions`.

I wanted a way to link all of the functions together so that -

- If the data that hasn't changed the corresponding functions won't be rerun
- If a function fails I'll know about it & understand why

I first found `prefect` & really enjoyed the error messages it provided on failing subfunctions & its ability to cache data & skip steps, however, my own team was not comfortable in `Python` so using `ploomber` felt a more natural fit since it was configurable via `yaml`.  In `ploomber` they could edit a config file to change or update high-level aspects of the pipeline.

> I subsequently found [Jeremy Howard - I really like notebooks](https://www.youtube.com/watch?v=9Q6sLbz37gk) which counters Joel Gru's complaints, & proposes `nbdev` as a tool to enable notebook-driven software development


---
<br>

# Developer environment?

I couldn't make my mind up on how to share my `Python` environment.  I found `Python` packaging really hard.

I liked `poetry` but I couldn't use it for `GeoPandas` since this tool required a C-library called `GDAL` which was only installable via `conda`.

I liked `conda` but I didn't like that my dependencies weren't freezable[^4] & sharing `Python` libraries was weird since it didn't play nicely with `setup.py` & `pyproject.toml`[^5]. 

I liked `Docker` because I could use `poetry` within a `Docker` image & the resulting environment was consistently usable across laptops, however, I didn't like packaging an entire operating system (in this case 250MB-1GB) to run a few `Python` scripts.  It seemed overkill.  On the plus side `Docker` + `GitPod` did provide a shareable cloud-based code editor.  

I ended up using both `conda` & `Docker`.  Both could be used for sharing a local & cloud-based environment.  `Binder` enabled sharing a cloud-based `Jupyter Notebook` via `conda` & `GitPod` a cloud-based `Visual Studio Code` editor via `Docker`.


---
<br>

[^1]: I first tried [dgorissen/pycel](https://github.com/dgorissen/pycel) but couldn't make it work with this spreadsheet.  Even if I had managed this, it wouldn't have generated a `numpy` based model so wouldn't have scaled well to thousands of buildings.
[^2]: I helped the [`Fugue`](https://github.com/fugue-project/fugue) team with their documentation as I tried it & liked it.  I felt it alleviated some of my pain around `Python` data wrangling by providing a single interface that runs on multiple engines like `pandas`, `Dask`, `Spark`.
[^3]: Provided that the underlying dataset fits into memory
[^4]: [`conda/conda-lock`](https://github.com/conda/conda-lock) now provides that missing lockfile
[^5]: I remember at the time that my workaroudn for installing a library was like `conda env create --name <env> --file environment.yml .` & then `pip install --no-deps -e .`
