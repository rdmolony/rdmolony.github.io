{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    utils.url = "github:numtide/flake-utils";
  };
  outputs = { self, nixpkgs, utils }: utils.lib.eachDefaultSystem (system:
    let
      pkgs = nixpkgs.legacyPackages.${system};
      
      jekyll-serve = pkgs.writeShellScriptBin "jekyll-serve" ''
        set -euo pipefail
        echo "Installing gems..."
        bundle config set --local path 'vendor/bundle'
        bundle install
        echo "Starting Jekyll with live reload..."
        bundle exec jekyll serve --livereload --port 4000
      '';
      
      tailwind-watch = pkgs.writeShellScriptBin "tailwind-watch" ''
        set -euo pipefail
        echo "Starting Tailwind CSS watcher..."
        ${pkgs.tailwindcss}/bin/tailwindcss --watch -i ./tailwind.css -o ./assets/css/tailwind.css
      '';
      
      dev-server = pkgs.writeShellScriptBin "dev-server" ''
        set -euo pipefail
        echo "Starting Jekyll blog development server..."
        ${jekyll-serve}/bin/jekyll-serve &
        JEKYLL_PID=$!
        ${tailwind-watch}/bin/tailwind-watch &
        TAILWIND_PID=$!
        
        cleanup() {
          echo "Shutting down servers..."
          kill $JEKYLL_PID $TAILWIND_PID 2>/dev/null || true
        }
        trap cleanup EXIT
        
        wait
      '';
    in
    {
      devShells.default = pkgs.mkShell {
        buildInputs = with pkgs; [
          # Ruby ecosystem
          ruby_3_2
          (bundler.override { ruby = ruby_3_2; })
          
          # Jekyll and Tailwind tools
          jekyll-serve
          tailwind-watch
          dev-server
          tailwindcss
          
          # Development tools
          git-lfs
        ];
        
        shellHook = ''
          echo "🚀 Jekyll blog development environment"
          echo "Available commands:"
          echo "  jekyll-serve    - Start Jekyll server with live reload"
          echo "  tailwind-watch  - Start Tailwind CSS watcher"
          echo "  dev-server      - Start both Jekyll and Tailwind"
          echo ""
          echo "Quick start: run 'dev-server' to start both services"
        '';
      };
    }
  );
}
