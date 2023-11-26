---
title: "Elixir Livebook Notebooks - First Impression"
layout: post
tags:
 - elixir
 - notebooks
published: false
---

# Smart cells

This is just amazing.

I watched Jose Valim, the creator of `Elixir`, demo using smart cells to convert speech to text without writing any code.  It automatically handles downloading any AI model required from `Hugging Face` or elsewhere.

Even better,  I can copy & paste the `Elixir` code used to generate the interface & actually run the model,  so I wanted to I could use it in a web application.

# Introspection

I watched Jose Valim, the creator of `Elixir`, explain how "processes" work in `Elixir` by running `Elixir` code & plotting its behaviour graphically using a magic `Kino` function that tracked it & plotted it.

I've been trying to understand the `Elixir` & `Erlang` "actor" model for a while now,  & these interactive diagrams just made intuitive sense to me.

# Automatic syncing between cells

By default, `Livebook` doesn't sync between cells but rather marks cells as "stale" or "active" depending on whether or not the cell they depend upon has changed.  I wonder if I can opt in to automatic re-runs of "stale" cells?

# Getting Started

The `Getting Started` notebook was easy for me to run, understand & use - 

![livebook-home-page.png](/assets/images/livebook-home-page.png)

![welcome-to-livebook.png](/assets/images/welcome-to-livebook.png) 

I was particularly impressed by `Doctests` which use a code's documentation as unit tests.

In the following example ...

```elixir
defmodule MyModule do
  @moduledoc """
  This is an example of doctests:

      iex> 2 + 2
      5

      iex> 6 + 7
      13
  """
end
```

... `2 + 2` is compared against the expected output `5` & a warning is raised since the output should be `4`!

This is **really neat**.  When learning how to use a particular function it's really helpful to see examples,  & now not only do I not need to bother writing a test,  I'm encouraged to provide them!

Next up I tried `Distributed portals with Elixir`.

I really like the idea of using an interactive game to teach new concepts.  The game this example is modelled on is a classic which I had the pleasure of playing with a buddy on `PlayStation 3`.

I'm not sure, however, what's the right balance between "let's do something cool" & incidentally "here's how it works" and explaining something up front.

I've read up a bit around `Elixir` already so am a bit familiar, but even for me it was hard to get my head around the concepts & jargon -

- Pattern matching
- Anonymous functions
- Immutable data structures
- Processes
- Agents
- State

I do care but I could also see others not caring about these nuances. 

How do processes store state?

It seems I can start an agent like ...

```elixir
{:ok, agent} = Agent.start_link(fn -> [] end)
```

... which I can then ask for state like ...

```elixir
Agent.get(agent, fn list -> list end)
```

... which returns `[]`.

So in this case the agent doesn't seem to actually store anything but rather calls the function when it's sent a message?

I can update the function run by the agent so that it appends `0` to a list ...

```elixir
Agent.update(agent, fn list -> [0 | list] end)
Agent.get(agent, fn list -> list end)
```

Nice.  But now if the `Agent` needs `list` to evaluate `[0 | list]` then where does `list` come from?   Why does `Agent` now return `[0]` if I am not defining an empty list anywhere?

I asked `ChatGPT4` ...

> With `Agent.update`, you send a message to the agent's process to update its state. The function `fn list -> [0 | list] end` takes the current state of the agent (`list`) and returns a new state with `0` prepended to it. After this operation, the state of the agent becomes `[0]`.

Hmmm.

What if the process is killed?  Does the process store state in its memory or does it run instructions to generate state when asked to do so?

> When an Elixir process, such as an Agent, is killed, the state it holds in memory is lost. This is because Elixir (and the Erlang VM it runs on) primarily uses in-memory storage for processes. 

Okay,  so perhaps I can consider mutating the state on a process to the same as mutating an object in an `Object Oriented` language like `Python`.

Why is this any better?


