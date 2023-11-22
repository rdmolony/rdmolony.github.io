---
title: "Importing files to TimescaleDB via Django"
layout: post
tags:
 - python
 - django
 - django-rest-framework
 - dramatiq
 - timescaledb
---

I wanted to import files to `TimescaleDB` via `Django`.

How did I do it?

- [Task Queues](#task-queues)
- [Via Application Programming Interface (API)](#via-application-programming-interface-api)
- [Via User Interface (UI)](#via-user-interface-ui)
- [Reformat before saving](#reformat-before-saving)


---
<br>

# Task Queues

If someone uploads a gigabyte of sensor readings,  the backend might take some time to process & import them.  I don't like leaving people waiting while the backend runs,  so I opted for processing files using a task queue.

> A task queue works like a restaurant.  The waiters add an order to the queue & the chefs or workers pull orders from the queue when they have time to process it.

In my case,  `Django` was running on a `Windows` server so the best, compatible task queue was `dramatiq`.

<DIAGRAM>

How will people know when the file has been processed?

For end-users I chose to track file upload status on the associated model.  I can then use this to show file status in the UI.  

I also track task status using the `django-dramatiq` `admin` page.

Lastly,  I can view running `SQL` queries using ...

<EXAMPLE>


---
<br>


# Via Application Programming Interface (API)

The most important part of my web application was API file uploads since it accounted for the majority.

I leaned on `django-rest-framework` as a mature framework extension to provide the abstractions I needed.


As shown in ...

<LINK>

... I can -

- Add a `FileField` to my `Django` model

<EXAMPLE>

- Create a `ModelSerializer` based on my model

<EXAMPLE>

- Create a `ViewSet` to handle requests to a certain endpoint like `/api/file/`

<EXAMPLE>


---
<br>


# Via User Interface (UI)

I was maintaing a `Django` web application for which it was useful to be able to manually upload files of sensor readings.

`Django` has good support on file uploads.

As shown in ...

<LINK>

... I can -

- Add a `FileField` to my `Django` model

<EXAMPLE>

- Create a `ModelForm` based on your model

<EXAMPLE>

- Render a `HTML` template with your form

<EXAMPLE>


---
<br>


# Reformat before saving

In this case I was saving readings from files in a standardised format,  so I wanted to reformat the readings before saving them.

I found I could adpat ...

<LINK> - Haki Benita

... to stream from files to `Postgres` ...



---
<br>