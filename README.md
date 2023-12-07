# Installation

- [Clone this repository locally](https://docs.github.com/en/repositories/creating-and-managing-repositories/cloning-a-repository)

I use ...

```sh
git clone git@github.com:rdmolony/rdmolony.github.io.git
```

... since I prefer to [authenticate with `GitHub` via `SSH`](https://docs.github.com/en/authentication/connecting-to-github-with-ssh)

- Install [`ruby`](https://ruby-lang.org/) & [`jekyll`](https://jekyllrb.com/)
  
> [!NOTE]
> `jekyll` transforms `Markdown` files into `HTML/CSS/JS` which the browser can understand

I use ...

```sh
nix profile install nixpkgs#ruby
```

> [!WARNING]
> As of 23-12-07, `nix` only works on `Linux` & `MacOS`

... and ...

```sh
gem install bundler jekyll
```

... and lastly ...

```sh
bundle install
```

> [!WARNING]
> The first time I set this up [I had a issues](https://github.com/rdmolony/til/blob/2b968e9e27516516c1afdbd979a4e183f640acae/til/fix-gem-not-installed-on-my-machine.md) which I fixed via `bundle config set --global path "$HOME/.bundle/"`


- Install [`nodejs`](https://nodejs.org/) & [`tailwindcss`](https://tailwindcss.com/)

> [!NOTE]
> `tailwindcss` transforms enables composing classes in `HTML` elements to make them look fancy
