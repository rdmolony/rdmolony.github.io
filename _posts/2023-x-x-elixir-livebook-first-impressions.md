---
title: "Pluto.jl Notebooks - First Impression"
layout: post
tags:
 - elixir
 - notebooks
---

- Smart cells

  This is just amazing.

  I watched Jose Valim, the creator of `Elixir`, demo using smart cells to convert speech to text without writing any code.  It automatically handles downloading any AI model required from `Hugging Face` or elsewhere.

  Even better,  I can copy & paste the `Elixir` code used to generate the interface & actually run the model,  so I wanted to I could use it in a web application.

- Introspection

  I watched Jose Valim, the creator of `Elixir`, explain how "processes" work in `Elixir` by running `Elixir` code & plotting its behaviour graphically using a magic `Kino` function that tracked it & plotted it.

  I've been trying to understand the `Elixir` & `Erlang` "actor" model for a while now,  & these interactive diagrams just made intuitive sense to me.

- Automatic syncing between cells

  By default, `Livebook` doesn't sync between cells but rather marks cells as "stale" or "active" depending on whether or not the cell they depend upon has changed.  I wonder if I can opt in to automatic re-runs of "stale" cells?
