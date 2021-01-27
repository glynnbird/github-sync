# github-cloudant-sync

Links a GitHub repo containing JSON or GeoJSON, writing matching documents to a Cloudant/CouchDB service on each commit.

## Step 1 - IBM Cloud Function

First we are going to create an IBM Cloud function which will be called for every GitHub commit.

- Visit the [Functions dashboard in the IBM Cloud](https://cloud.ibm.com/functions).
- Click on [Actions](https://cloud.ibm.com/functions/actions)
- Then ["Create" ---> "Action"](https://cloud.ibm.com/functions/create/action)
- Give your action a name and chose the Node.js runtime. Click "Create".
- Cut and paste the code from [here](https://github.com/glynnbird/github-sync/blob/main/index.js) into the source editor and click "Save"
- In the "Endpoints" panel, tick the "Enable as Web Action" and "Raw HTTP Handling" tick boxes and click "Save". A web action has an public HTTP endpoint which will plumb into the GitHub Webhook system. We need to be sent the raw HTTP body because we need to calculate a cryptographic signature of the data to verify that it came from GitHub and not a malicious soure.
- Make a note of the URL of your Cloud Function - we'll need this URL in the next step.

## Step 2 - GitHub WebHook

- Create a [new GitHub repository](https://github.com/new).
- In the repository's Settings panel, under the Webhooks sub-menu, click "Add webhook".
- Enter the URL from the first step, choose a content type of "application/json" and enter a secret. Make a note of the secret, as we'll need it in step 4. Click "Add Webhook"

## Step 3 - Create a Cloudant service

- In the IBM Cloud dashboard, browse the catalog to find the [Cloudant service](https://cloud.ibm.com/catalog/services/cloudant).
- Choose a region, set the authentication method to "IAM and legacy credentials" and choose the plan (Lite is free). Click "Create".
- Once provisioned, in the service's "Service Credentials" menu, click "New Credential".
- Inspect the newly created credential and make a note of the "url" field - we'll need this in Step 4.
- Visit the Cloudant dashboard and create a new database called "github".

## Step 4 - Configuring the Cloud Function

- Revisit the Cloud Function you created in Step 1.
- Under the "parameters" menu add two new parameters:
- 1. `GITHUB_SECRET` - the secret generated in step 2.
- 2. `COUCH_URL` - the Cloudant URL generated in step 3.
- Note that the two parameters need to be enclosed in double quotes. 

## Step 5 - That's it!

Try creating, editing and deleting JSON documents in your GitHub repository - you should see them mirrored in your Cloudant service's "github" database.

Note that data only travels one way: from GitHub to Cloudant.

