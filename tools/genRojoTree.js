const fs = require("fs");
const path = require("path");

const BASE_PATH = path.join(__dirname, "../src");

const BLACKLISTED_DIRS = [
  toPosix(path.join(BASE_PATH, "ui")),
  toPosix(path.join(BASE_PATH, "startup")),
];

// Tracks folders that are "claimed" by init.luau
const initClaimedFolders = new Set();

function toPosix(p) {
  return p.split(path.sep).join("/");
}

function toPascalCase(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function getVirtualPath(filepath) {
  const relativePath = path.relative(BASE_PATH, filepath);
  const parts = relativePath.split(path.sep);
  const filename = path.basename(filepath, ".luau");
  const isServer = filename.toLowerCase().includes("server");

  const folderName = parts.length > 1 ? toPascalCase(parts[parts.length - 2]) : "";
  let name;

  if (filename === "init") {
    name = folderName;
  } else if (["server", "client", "utils", "types"].includes(filename.toLowerCase())) {
    name = folderName + toPascalCase(filename);
  } else {
    name = filename;
  }

  return {
    isInit: filename === "init",
    target: isServer ? "ServerScriptService" : "ReplicatedStorage",
    folder: parts.slice(0, -1).map(toPascalCase),
    name,
    file: filename === "init"
    ? toPosix(path.join("src", ...parts.slice(0, -1)))
    : toPosix(path.join("src", ...parts)),
  };
}

const tree = {
  name: "genrojotree",
  tree: {
    $className: "DataModel",

    ReplicatedStorage: {
      Shared: {
        $className: "Folder",
        Services: { $className: "Folder", },
        Classes: {  $className: "Folder", },
        Modules: { $className: "Folder", }
      },
      Packages: { $path: "Packages", },
      UI: { $path: "src/ui", },
    },

    ServerScriptService: {
      Server: { $path: "src/startup/Server.server.luau", },
      Services: { $className: "Folder", },
      Classes: { $className: "Folder", },
      Modules: { $className: "Folder", },
    },

    StarterPlayer: {
      StarterPlayerScripts: {
        Client: { $path: "src/startup/Client.client.luau", }
      },
    },
  }
};

const sharedRoot = tree.tree.ReplicatedStorage.Shared;
const serverRoot = tree.tree.ServerScriptService;

// Recursively walk all files
function walk(dir, callback) {
  if (BLACKLISTED_DIRS.includes(toPosix(dir))) return;

  fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, callback);
    } else if (entry.isFile() && entry.name.endsWith(".luau")) {
      callback(full);
    }
  });
}

walk(BASE_PATH, (filepath) => {
  const { target, folder, name, file, isInit } = getVirtualPath(filepath);
  const root = target === "ServerScriptService" ? serverRoot : sharedRoot;

  const fullFolderKey = folder.join("/");

  // If it's init.luau, promote the parent folder
  if (isInit) {
    const parent = folder.slice(0, -1).reduce((acc, part) => {
      if (!acc[part]) acc[part] = { $className: "Folder" };
      return acc[part];
    }, root);

    parent[name] = { $path: file };
    initClaimedFolders.add(fullFolderKey);
    return;
  }

  // If folder was claimed by init.luau, skip assigning children
  if (initClaimedFolders.has(fullFolderKey)) return;

  let current = root;
  for (const part of folder) {
    if (!current[part]) current[part] = { $className: "Folder" };
    current = current[part];
  }

  current[name] = { $path: file };
});

fs.writeFileSync("default.project.json", JSON.stringify(tree, null, 2));
console.log("✅ default.project.json generated.");
