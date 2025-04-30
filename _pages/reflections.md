---
title: Reflections
layout: page
permalink: /reflections/
---

# Reflections

<div class="text-center mt-4 mb-20">

  <ul class="list-none pl-0 mb-8">
    {%- for post in site.posts -%}
    {% if post.archived == false and post.reflection == true %}
    <li class="info-box m-2 p-2">
      {%- assign date_format = site.minima.date_format | default: "%b %-d, %Y" -%}
      <span class="text-xs">{{ post.date | date: date_format }}</span>
      <h3>
        <a href="{{ post.url | relative_url }}">
          {{ post.title | escape }}
        </a>
      </h3>
      {% if post.show_description %}
        <div>
          <p>
            {{ post.description | escape }}
          </p>
        </div>
      {% endif %}
    </li>
    {%- endif -%}
    {%- endfor -%}
  </ul>

</div>
