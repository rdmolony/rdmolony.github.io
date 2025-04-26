{
  inputs = {
    utils.url = "github:numtide/flake-utils";
  };
  outputs = { self, nixpkgs, utils }: utils.lib.eachDefaultSystem (system:
    let
      pkgs = nixpkgs.legacyPackages.${system};
      run-jekyll = pkgs.writeShellScriptBin "run-jekyll" ''
        ${pkgs.ruby}/bin/bundle exec jekyll serve --livereload
      '';
      run-tailwind = pkgs.writeShellScriptBin "run-tailwind" ''
        npx @tailwindcss/cli --watch -i ./tailwind.css -o ./assets/css/tailwind.css
      '';
      run-storybook = pkgs.writeShellScriptBin "run-storybook" ''
        npx storybook dev
      '';
    in
    {
      devShell = pkgs.mkShell {
        buildInputs = with pkgs; [
          run-jekyll
          run-tailwind
          run-storybook
          ruby
          nodejs
        ];
      };
    }
  );
}
