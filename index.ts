import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";


// Import our Pulumi configuration.
const config = new pulumi.Config();
const dbName = config.require("db_name");
const dbUsername = config.require("db_username");
const dbPassword = config.require("db_password");
const adminUsername = config.require("admin_username");
const adminPassword = config.require("admin_password");

// Get the default VPC and ECS Cluster for your account.
const vpc = aws.ec2.Vpc.get("aws-default-vpc","vpc-02a8a14ab85726904", );

const subnet1 = aws.ec2.Subnet.get("aws-default-subnet-1","subnet-0c71e1108a994ac38" );
const subnet2 = aws.ec2.Subnet.get("aws-default-subnet-2","subnet-0045cc147b1543650" );
const subnet3 = aws.ec2.Subnet.get("aws-default-subnet-3","subnet-0284d6538812c701d" );

const cluster = new aws.ecs.Cluster("cluster1", {settings: [{
    name: "containerInsights",
    value: "enabled",
}]});

// Create a new subnet group for the database.
const subnetGroup = new aws.rds.SubnetGroup("default", {
    subnetIds: [subnet1.id, subnet2.id, subnet3.id],
    tags: {
        Name: "My DB subnet group",
    },
});
// Create a new database, using the subnet and cluster groups.
const db = new aws.rds.Instance("schooldb", {
    engine: "mysql",
    instanceClass: aws.rds.InstanceTypes.T2_Micro,
    allocatedStorage: 5,
    dbSubnetGroupName: subnetGroup.name,
    vpcSecurityGroupIds: ["sg-07f94651cf930b3c2"],
    name: dbName,
    username: dbUsername,
    password: dbPassword,
    skipFinalSnapshot: true,
});

// Assemble a connection string for the school service.
const connectionString = pulumi.interpolate `mysql://${dbUsername}:${dbPassword}@${db.endpoint}:3306/schooldb`;

// Create an NetworkListener to forward HTTP traffic on port 3000.
//const listener = new aws.lb.Listener("lb", { port: 3000 });

const service = new awsx.ecs.FargateService("service", {
    cluster : cluster.arn,
    assignPublicIp: true,
    desiredCount: 1,
    forceNewDeployment: true,
    taskDefinitionArgs: {
        container: {
                image: "623865992637.dkr.ecr.ap-south-1.amazonaws.com/school-app:latest",
                portMappings: [
                  { containerPort: 3000 }
                ],
                environment: [
                    { name: "DB_HOST", value: "schooldbb108010.cvcmgo9c9own.ap-south-1.rds.amazonaws.com" },
                    { name: "DB_PORT", value: "3306"},
                    { name: "DB_USER_NAME", value: dbUsername },
                    { name: "DB_USER_PASSWORD", value: dbPassword },
                    { name: "DB_NAME", value: dbName}
,
                ],
                memory : 2048,
                cpu : 1 
            }
        }
    }
);