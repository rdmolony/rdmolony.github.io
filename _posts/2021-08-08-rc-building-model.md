---
title: "rc-building-model"
category: blog
tags:
  - link
  - pandas
  - numpy
---
A reimplementation of SEAI's Dwelling Energy Assessment Procedure (DEAP) model in Python.  Whereas DEAP's Excel implementation is limited to one building at a time `rc-building-model` is capable of modelling DEAP parameters (such as fabric heat loss) for hundreds of thousands of buildings instantaneously thanks to `pandas` and `numpy`.  It is also the first model able to calculate BER ratings.  

It was created because adapting existing building stock models (see [here](https://wiki.openmod-initiative.org/wiki/Open_Models) and [here](https://github.com/protontypes/open-sustainable-technology)) to work with the Irish building stock proved troublesome.  We wanted the model to be fast and to calculate at an individual building level.  Existing models were either top-down, intrinsically tied to a user interface ([cityenergyanalyst](https://cityenergyanalyst.com/)), designed for individual buildings only ([energyplus](https://energyplus.net/)) or implemented in `Modelica`.  

<div><a href="https://github.com/codema-dev/rc-building-model" class="btn btn--primary">Github</a></div>
