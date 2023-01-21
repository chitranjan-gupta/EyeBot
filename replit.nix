{ pkgs }: {
	deps = [
		pkgs.nano
  pkgs.toybox
  pkgs.nodejs
        pkgs.nodePackages.typescript-language-server
        pkgs.yarn
        pkgs.replitPackages.jest
	];
}
