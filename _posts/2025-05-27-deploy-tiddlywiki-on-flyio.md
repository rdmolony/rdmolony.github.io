---
title: "Deploy TiddlyWiki on fly.io"
layout: "post"
description: |
  I walk through how to run TiddlyWiki server on Fly, and only pay for the compute that you use
archived: false
how_to: true
---

I've been running my own TiddlyWiki on [fly.io](https://fly.io) since August 2024, and it has cost me less than five dollars to date - I'm still on the free-tier.

> If running your own server isn't your thing, I'd strongly recommend going with with [one of the officially recommended hosting options](https://tiddlywiki.com/#Quick%20Start) instead. 


I didn't find it that straightforward to figure out initially how to deploy a wiki on fly, and so I put together [a GitHub Template](https://github.com/rdmolony/tiddlywiki-on-flyio) so likeminded people don't have to make the same mistakes I did.

Why [fly.io](https://fly.io)? It scales to zero, so you only have to pay for the compute you use. I’ve been using this setup for many months now, and I still haven’t used up my 5 dollar free tier.

Caveats -

- The guide requires executing some commands on the command line

- I don’t believe that authentication is particularly secure. I use a 60 character password (which I store in a password manager), however, I’m still not that comfortable with this being exposed to the public internet. It would be better to rely on an authentication service (like AWS Cognito) instead, though I haven’t integrated this yet.

If you have any feedback, let me know on the [template repository](https://github.com/rdmolony/tiddlywiki-on-flyio)
