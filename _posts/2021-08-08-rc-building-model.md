---
title: "rc-building-model"
category: blog
tags:
  - link
---
A reimplementation of SEAI's Dwelling Energy Assessment Procedure (DEAP) model in Python.

It is the first stock model to capable of calculating BER ratings at scale.  Where DEAP's Excel implementation is limited to one building at a time `rc-building-model` is capable of modelling DEAP parameters (such as fabric heat loss) for hundreds of thousands of buildings instantaneously thanks to `pandas` and `numpy`.

It was created as adapting existing building stock models (see [here](https://wiki.openmod-initiative.org/wiki/Open_Models) and [here](https://github.com/protontypes/open-sustainable-technology)) to work with the Irish building stock proved troublesome.  We wanted the model to be fast and to operate at an individual building level.  Existing models were either top-down, intricately tied to a user interface ([cityenergyanalyst](https://cityenergyanalyst.com/)), designed for individual buildings only ([energyplus](https://energyplus.net/)) or implemented in `Modelica`.  


<div><a href="https://github.com/codema-dev/rc-building-model" class="btn btn--primary">Github</a></div>
