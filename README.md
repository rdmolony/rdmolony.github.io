# Installation

- [Clone this repository locally](https://docs.github.com/en/repositories/creating-and-managing-repositories/cloning-a-repository)

    I use ...

    ```sh
    git clone git@github.com:rdmolony/rdmolony.github.io.git
    ```

    ... since I prefer to [authenticate with `GitHub` via `SSH`](https://docs.github.com/en/authentication/connecting-to-github-with-ssh)

- Install [`ruby`](https://ruby-lang.org/) & [`jekyll`](https://jekyllrb.com/)[^JEKYLL]
    
    [^JEKYLL]: `jekyll` transforms `Markdown` files into `HTML/CSS/JS` which the browser can understand

    I use [`nix`](https://github.com/DeterminateSystems/nix-installer)[^NIX] ...

    ```sh
    nix profile install nixpkgs#ruby
    ```

    [^NIX]: As of 2023, `nix` only works on `Linux` & `MacOS`

    ... and thus `gem` ...

    ```sh
    gem install bundler jekyll
    ```

    ... and thus `bundler`[^BUNDLER] ...

    ```sh
    bundle install
    ```

    [^BUNDLER]: The first time I set this up [I had issues](https://github.com/rdmolony/til/blob/2b968e9e27516516c1afdbd979a4e183f640acae/til/fix-gem-not-installed-on-my-machine.md) which I fixed via `bundle config set --global path "$HOME/.bundle/"`

    ... to install this project's dependencies from `Gemfile.lock`


- Install [`nodejs`](https://nodejs.org/) & [`tailwindcss`](https://tailwindcss.com/)[^TAILWIND]

    [^TAILWIND]: `tailwindcss` transforms enables composing classes in `HTML` elements to make them look fancy

    I use [`nix`](https://github.com/DeterminateSystems/nix-installer)[^NIX] ...

    ```sh
    nix profile install nixpkgs#nodejs
    ```

    ... and thus `npm` ...

    ```sh
    npm install -D tailwindcss
    ```

- Install [`foreman`](https://github.com/ddollar/foreman)[^FOREMAN]

    I use ...

    ```sh
    gem install foreman
    ```

    [^FOREMAN]: `foreman` enables running multiple services at the same time - in this case `jekyll` & `tailwindcss`.  Note that [it is not recommended to add `foreman` to a `Gemfile`](https://github.com/ddollar/foreman)

- **Run it** ...

    ```sh
    foreman start
    ```
