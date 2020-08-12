# react-nginx

Project based on CDK.
This is a demo project to showcase a react app running privately on nginx based container on Fargate. No need to re-build the Docker image as it is already exposed on my DockerHub account.

Steps to deploy infrastructure:

1) make sure you are on the right aws profile
2) export both the CDK_DEPLOY_ACCOUNT and CDK_DEFAULT_REGION environment variables to reflect your environment
3) update the config.ts file according to your environment
3) cd infrastructure
4) npm run build
5) cdk deploy
