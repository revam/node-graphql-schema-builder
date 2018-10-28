# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] - 2018-10-28

### Added

- Added a method for importing values from individual files.

- Added some exports from peer-dependencies "graphql-tools" and "graphql-tag".

- Added new interface and type exports.

- Added ability to check if an id is registered with builder.

- Added a method (`prepareSchema`) to prepare a schema.

- Added more advanced sorting. You can now spesify imports to load before or
  after one or multiple other imports, and spesify if the import should load
  at the start or end of the list when preparing/building a schema.

### Changed

- Method `addDefinitions` on builder now accepts either a string or a
  `DocumentNode`.

- Updated examples in readme.

### Fixed

- Method `addDirectives` and related functionality was using incorrect type for
  directive visitors.

### Removed

- Removed all arguments from constructor. (And the constructor block in source)

## [0.1.1] - 2018-10-23

### Added

- Linting rules. Also, fixed errors/warnings in code.

### Changed

- Renamed method `getSchema` to `buildSchema`.

- Minor tweaks to comments and import order.

## 0.1.0 - 2018-07-12

### Added

- Initial release

[Unreleased]: https://github.com/revam/node-graphql-schema-builder/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/revam/node-graphql-schema-builder/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/revam/node-graphql-schema-builder/compare/v0.1.0...v0.1.1
