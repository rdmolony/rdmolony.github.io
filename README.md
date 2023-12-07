# Installation

- [Clone this repository locally](https://docs.github.com/en/repositories/creating-and-managing-repositories/cloning-a-repository)

    I use ...

    ```sh
    git clone git@github.com:rdmolony/rdmolony.github.io.git
    ```

    ... since I prefer to [authenticate with `GitHub` via `SSH`](https://docs.github.com/en/authentication/connecting-to-github-with-ssh)

- Install [`ruby`](https://ruby-lang.org/) & [`jekyll`](https://jekyllrb.com/)[^BOO]
    
    [^BOO]: `jekyll` transforms `Markdown` files into `HTML/CSS/JS` which the browser can understand

    I use [`nix`](https://github.com/DeterminateSystems/nix-installer)[^BOT] ...

    ```sh
    nix profile install nixpkgs#ruby
    ```

    [^BOT]: As of 2023, `nix` only works on `Linux` & `MacOS`

    ... and `gem` ...

    ```sh
    gem install bundler jekyll
    ```

    ... and lastly `bundle`[^XOO] ...

    ```sh
    bundle install
    ```

    [^XOO]: The first time I set this up [I had issues](https://github.com/rdmolony/til/blob/2b968e9e27516516c1afdbd979a4e183f640acae/til/fix-gem-not-installed-on-my-machine.md) which I fixed via `bundle config set --global path "$HOME/.bundle/"`

    ... to install this project's dependencies from `Gemfile.lock`


- Install [`nodejs`](https://nodejs.org/) & [`tailwindcss`](https://tailwindcss.com/)[^HAT]

    [^HAT]: `tailwindcss` transforms enables composing classes in `HTML` elements to make them look fancy

- Install [`foreman`](https://github.com/ddollar/foreman)[^AHH]

    I use ...

    ```sh
    gem install foreman
    ```

    [^AHH]: `foreman` enables running multiple services at the same time - in this case `jekyll` & `tailwindcss`

- **Run it** ...

    ```sh
    foreman start
    ```
