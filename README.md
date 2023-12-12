## Installation

- [Clone this repository locally](https://docs.github.com/en/repositories/creating-and-managing-repositories/cloning-a-repository)[^GITHUB]

- Install [`ruby`](https://ruby-lang.org/)[^RUBY] & thus [`jekyll`](https://jekyllrb.com/)[^JEKYLL], [`bundler`](https://github.com/rubygems/bundler)[^BUNDLER] & [`foreman`](https://github.com/ddollar/foreman)[^FOREMAN]
    
- Install this project's `gems` via `bundler` from `Gemfile.lock`

    ```sh
    bundle install
    ```

- Install [`nodejs`](https://nodejs.org/)[^NODEJS] & thus [`tailwindcss`](https://tailwindcss.com/)[^TAILWIND]

- **Run it** ...

    ```sh
    foreman start
    ```

---

<details>
<summary>Footnotes</summary>

[^BUNDLER]:
    
    Enables installing `gems` from `Gemfile` & `Gemfile.lock` 

    I use [`gem`](https://ruby-lang.org/) ...

    ```sh
    gem install bundler
    ```

    The first time I set this up [I had issues](https://github.com/rdmolony/til/blob/2b968e9e27516516c1afdbd979a4e183f640acae/til/fix-gem-not-installed-on-my-machine.md) which I fixed via `bundle config set --global path "$HOME/.bundle/"`

[^FOREMAN]:

    `foreman` enables running multiple services at the same time - in this case `jekyll` & `tailwindcss`

    I use [`gem`](https://ruby-lang.org/) ...

    ```sh
    gem install foreman
    ```

[^GITHUB]:

    I use [`git clone`](https://git-scm.com/) ...

    ```sh
    git clone git@github.com:rdmolony/rdmolony.github.io.git
    ```

    ... since I prefer to [authenticate with `GitHub` via `SSH`](https://docs.github.com/en/authentication/connecting-to-github-with-ssh)

[^JEKYLL]:
    
    `jekyll` transforms `Markdown` files into `HTML/CSS/JS` which the browser can understand

    I use [`gem`](https://ruby-lang.org/) ...

    ```sh
    gem install jekyll
    ```

[^NODEJS]:

    A `JavaScript` runtime

    I use [`nix`](https://github.com/DeterminateSystems/nix-installer) ...

    ```sh
    nix profile install nixpkgs#nodejs
    ```

[^RUBY]:

    I use [`nix`](https://github.com/DeterminateSystems/nix-installer) ...

    ```sh
    nix profile install nixpkgs#ruby
    ```

[^TAILWIND]:

    `tailwindcss` makes it so much easier to style a web page,  you just add multiple `tailwind` classes to `HTML` elements & `tailwindcss` combines these classes together to define things font size, type, color

    I use [`npm`](https://nodejs.org/) ...

    ```sh
    npm install -D tailwindcss
    ```
