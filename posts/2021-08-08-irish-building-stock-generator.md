---
title: "Irish Building Stock Generator"
category: blog
tags:
  - link
---
An interactive web application that generates a complete Irish residential building stock.  

`ibsg` loads the Building Energy Rating (BER) dataset, filters out buildings containing user input errors by applying filters, merges the BERs with the complete 2016 Census & fills any unknown buildings with archetypes.

It was created because two Irish energy researchers (Ciara Ahern and Tomas Mac Uidhir) found that the outputs of their research differed due to the differing data cleaning steps.  Automating the generation of the Irish building stock enables multiple energy modellers to use the same building stock with the same assumptions.   Keeping it open-source enables them to challenge and feed into the process leading to continual improvement of the underlying data.  It's also massively time saving as handling big data using traditional tools is not straightforward.

<div><a href="https://github.com/energy-modelling-ireland/ibsg" class="btn btn--primary">Github</a></div>

<div><a href="https://energy-modelling-ireland.github.io" class="btn btn--primary">energy-modelling-ireland.github.io</a></div>