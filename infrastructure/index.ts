import cdk = require('@aws-cdk/core');
import ec2 = require('@aws-cdk/aws-ec2');
import ecs = require('@aws-cdk/aws-ecs');
import {Compatibility} from "@aws-cdk/aws-ecs";
import {SubnetType, UserData, WindowsImage, WindowsVersion} from "@aws-cdk/aws-ec2";
// import ecs_patterns = require('@aws-cdk/aws-ecs-patterns');
import config from "../config";
import {CfnInstanceProfile, ManagedPolicy, Role, ServicePrincipal} from "@aws-cdk/aws-iam";
import {Fn, Resource, Tag} from "@aws-cdk/core";

// Based on https://aws.amazon.com/blogs/compute/introducing-cloud-native-networking-for-ecs-containers/
const app = new cdk.App();
const stack = new cdk.Stack(app, 'ecs-fargate-private-react-webapp', {
    env: {
        account: process.env.CDK_DEPLOY_ACCOUNT || process.env.CDK_DEFAULT_ACCOUNT,
        region: process.env.CDK_DEPLOY_REGION || process.env.CDK_DEFAULT_REGION
    }
});

const testEc2stack = new cdk.Stack(app, 'ecs-fargate-private-react-webapp-test-ec2', {
    env: {
        account: process.env.CDK_DEPLOY_ACCOUNT || process.env.CDK_DEFAULT_ACCOUNT,
        region: process.env.CDK_DEPLOY_REGION || process.env.CDK_DEFAULT_REGION
    }
});

interface Ec2InstanceProps {
    image : ec2.IMachineImage;
    instanceType : ec2.InstanceType;
    userData? : UserData;
    subnet : ec2.ISubnet;
    role : Role;
    vpc: string;
}

class Ec2 extends Resource {
    readonly instance: ec2.CfnInstance;

    constructor(scope: cdk.Construct, id: string, props? : Ec2InstanceProps) {
        super(scope, id);

        if (props) {

            //create a profile to attach the role to the instance
            const profile = new CfnInstanceProfile(this, `${id}Profile`, {
                roles: [ props.role.roleName ]
            });

            // create the instance
            if (props.userData) {
                this.instance = new ec2.CfnInstance(this, id, {
                    imageId: props.image.getImage(this).imageId,
                    instanceType: props.instanceType.toString(),
                    networkInterfaces: [
                        {
                            deviceIndex: "0",
                            subnetId: props.subnet.subnetId
                        }
                    ]
                    , userData: Fn.base64(props.userData.render())
                    , iamInstanceProfile: profile.ref
                });
            } else {
                this.instance = new ec2.CfnInstance(this, id, {
                    imageId: props.image.getImage(this).imageId,
                    instanceType: props.instanceType.toString(),
                    networkInterfaces: [
                        {
                            deviceIndex: "0",
                            subnetId: props.subnet.subnetId
                        }
                    ]
                    , iamInstanceProfile: profile.ref
                });
            }


            // tag the instance
            Tag.add(this.instance, 'Name', `${testEc2stack.stackName}/${id}`);
        }
    }
}

const vpc = ec2.Vpc.fromLookup(stack, 'VPC',
    {
        vpcId: config.vpcId,
    }
);

//******* Test EC2 Stack *******//
const role = new Role(testEc2stack, 'TmrEc2SsmRole', {
    assumedBy: new ServicePrincipal('ec2.amazonaws.com')
});
// arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore
role.addManagedPolicy(ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'));

const ec2obj = new Ec2(testEc2stack, 'TestEc2Win2019Priv', {
    image: new WindowsImage(WindowsVersion.WINDOWS_SERVER_2019_ENGLISH_FULL_BASE),
    instanceType : ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE3, ec2.InstanceSize.LARGE),
    vpc: vpc.vpcId,
    subnet : vpc.privateSubnets[0],
    role: role
});
//******* END - Test EC2 Stack *******//

// Create the cluster
const cluster = new ecs.Cluster(stack, 'FargateCluster', { vpc });

// create a task definition with CloudWatch Logs
const logging = new ecs.AwsLogDriver({
    streamPrefix: "ecs",
})

const taskDef = new ecs.TaskDefinition(stack, "sqwe", {
    cpu: '256',
    memoryMiB: '512',
    compatibility:Compatibility.FARGATE,
    networkMode: ecs.NetworkMode.AWS_VPC,
})

taskDef.addContainer("AppContainer", {
    image: ecs.ContainerImage.fromRegistry("limam/nginx-react:0.0.1"),
    logging,
})

// Create a security group that allows HTTP traffic on port 80 for our containers without modifying the security group on the instance
const securityGroup = new ec2.SecurityGroup(stack, 'nginx-80', {
    vpc,
    allowAllOutbound: true,
});

securityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80));

// Instantiate ECS Service with just cluster and image
new ecs.FargateService(stack, "FargateService", {
    cluster,
    taskDefinition: taskDef,
    desiredCount: 1,
    securityGroup,
    vpcSubnets: {
        subnetType: SubnetType.PRIVATE
    }
});

new cdk.CfnOutput(testEc2stack, 'EC2 instance Id', {
    value: ec2obj.instance.ref
});

app.synth();
