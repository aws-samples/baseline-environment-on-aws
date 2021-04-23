#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { BLEAdeployStack } from '../lib/bleadeploy-stack';

const pjPrefix = 'BLEA';

const app = new cdk.App();

// ----------------------- Load context variables ------------------------------
// (This is same as BLEA implementation)
// This context need to be specified in args
const argContext = 'environment';

// Environment Key (dev,stage,prod...)
// Should be defined in 2nd level of "context" tree in cdk.json
const envKey = app.node.tryGetContext(argContext);
if (envKey == undefined)
  throw new Error(`Please specify envieonment with context option. ex) cdk deploy -c ${argContext}=dev`);

// Array of envrionment variables. These values hould be defined in cdk.json or cdk.context.json
const envVals = app.node.tryGetContext(envKey);
if (envVals == undefined) throw new Error('Invalid environment.');

const procEnv = envVals['env']; // contains "account" and "region"

// ----------------------- Deploy CI/CD Stack  ------------------------------
new BLEAdeployStack(app, `${pjPrefix}-DeployStack`, {
  githubRepositoryOwner: envVals['githubRepositoryOwner'],
  githubRepositoryName: envVals['githubRepositoryName'],
  githubTargetBranch: envVals['githubTargetBranch'],
  env: procEnv,
});
