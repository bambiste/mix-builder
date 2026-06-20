#!/usr/bin/env node
// inquirer is a declared dependency of @bambiste/mix-builder, so it resolves from the
// package's own install (cli_prepare imports it directly). The old `pnpm add -D inquirer`
// fallback ran in the CONSUMER's project on every publish and reinstalled it each time.
import { publish } from './cli_prepare.js';

publish();
