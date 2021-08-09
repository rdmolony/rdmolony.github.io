---
title: "Energy Modelling"
category: blog
tags:
  - link
  - thesis
  - EnergyPLAN
---
I was first introduced to energy modelling by the late David McKay in his classic book [Sustainable Energy: Without the Hot Air](https://withouthotair.com/).  It uses back-of-the-envelope calculations to guesstimate consumption and production (using 2009 technologies, prices and data), and makes wild assumptions on renewable land usage to try to get them to balance without resorting to fossil fuels.

One year on I found myself struggling to create a reasonably accurate model of the Irish energy system using the [EnergyPLAN](https://www.energyplan.eu/) model for my MAI thesis.  Creating a model whose outputs resemble recorded outputs is tough.  EnergyPLAN is a free model, kindly maintained by Aalborg University researchers.  Bang in some energy system characteristics and it'll spit out emissions and energy usage.  Getting it "accurate" is a data snooping process of trial & error.  I lacked the necessary data to fill in all inputs and so resorted assumptions.  I made roughly 30, documented them and moved on.

EnergyPLAN model is useful in configuring a system with X percentage wind and finding out if "yeah that'll work" or "no, no, no, definitely not" but not so much (as of 2019) in figuring out how different system configurations compare.  It's possible to do so using [EPlanOpt](https://gitlab.inf.unibz.it/URS/EPLANopt) which optimises the configuration to be both least cost and lowest emissions system, however, if the model being optimised is garbage, optimised garbage is of no more use.

EnergyPLAN is top-down and so takes in aggregated system characteristics and spits out system estimates.  Moving on to Codema, we have instead relied on bottom-up models which are built up of individual buildings instead.  Unlike top-down these models can answer tell you who the big emmiters are and where they are.  As aggregated system estimates are [widely available](https://www.seai.ie/data-and-insights/seai-statistics/) top-down models are comparatively easier to spin up.  Bottom-up models rely on mashing together various incomplete data sources of differing levels of quality.

The residential outputs of our bottom-up model rely on the SEAI's `Building Energy Rating` dataset which is only contains individual building level characteristics but is only partially complete.  The input dataset is also `~1GB` and so crashes `Excel`.  Working with this "large" data requires a new toolkit.  Researchers at `UCC` have successfully used `Tableau` to wrangle and plot this data.  We opted for the `Python` data stack (specifically `pandas`).  It involves a longer learning curve but opens up a more powerful toolkit which is growing faster than `Tableau` ever could thanks to a growing number of open-source projects.

`Python` has enabled the creation of powerful visualisations (mostly `pandas-bokeh`), web applications (`streamlit`) and automated much of our workflow.  It forced us to split up data and logic which made swapping old data for new data straightforward.  It does however introduce a new problem -  it's hard to share code with non-coders.  The fact that some of the data we use is closed-access makes sharing in general even harder as those who might pick apart invalid assumptions can only read through our source code.

We're getting around this somewhat by serving our models as web applications with parameterisable assumptions.  Where the data is closed-access the code is written (to the best of our knowledge!) so that only the application can access it (by making an authenticated request to `s3` using environmental variables).  The big catch is that even with `streamlit` this all takes time.  Where it isn't possible to bring our work into our applications we're trying to document our assumptions alongside our visualisations so that they don't remain hidden in our source code.

<div><a href="{{ site.root_url }}/assets/pdfs/RMolony_MAI_Thesis_2019.pdf" class="btn btn--primary">Thesis</a></div>