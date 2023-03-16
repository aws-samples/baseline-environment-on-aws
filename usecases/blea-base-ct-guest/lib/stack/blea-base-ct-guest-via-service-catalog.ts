import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { CloudFormationProduct, Portfolio, ProductStack, ProductStackHistory } from 'aws-cdk-lib/aws-servicecatalog';
import { SecurityIAM } from '../construct/security-iam';
import { SecurityLogging } from '../construct/security-logging';
import { SecurityDetection } from '../construct/security-detection';
import { Role } from 'aws-cdk-lib/aws-iam';

export interface BLEABaseCTGuestSCProps extends StackProps {
  securityNotifyEmail: string;
}

export class BLEABaseCTGuestSCStack extends Stack {
  constructor(scope: Construct, id: string, props: BLEABaseCTGuestSCProps) {
    super(scope, id, props);

    class BaselineProduct extends ProductStack {
      constructor(scope: Construct, id: string) {
        super(scope, id);

        new SecurityIAM(this, 'SecurityIAM');

        // AWS CloudTrail configuration in Control Tower Landing Zone v3.0 will not create CloudWatch Logs LogGroup in each Guest Accounts.
        // And it will delete these LogGroups when AWS CloudTrial Configuration is disabled in case of updating Landing Zone version from older one.
        // BLEA should notify their alarms continuously. So, if there is no CloudTrail and CloudWatch Logs in Guest Account, BLEA creates them to notify the Alarms.
        const securityLogging = new SecurityLogging(this, 'SecurityLogging');

        // Security Alarms
        // !!! Need to setup SecurityHub, GuardDuty manually on Organizations Management account
        // AWS Config and CloudTrail are set up by ControlTower
        new SecurityDetection(this, 'SecurityDetection', {
          notifyEmail: props.securityNotifyEmail,
          cloudTrailLogGroupName: securityLogging.trailLogGroup.logGroupName,
        });
      }
    }

    const portfolio = new Portfolio(this, 'Portfolio', {
      displayName: 'BLEA Baselines for Guest accounts',
      providerName: 'Platform team at Example Company',
    });

    // Use history and lock each versions to update blueprints from AWS Control Tower.
    // See: https://docs.aws.amazon.com/controltower/latest/userguide/update-a-blueprint.html
    const productStackHistory = new ProductStackHistory(this, 'ProductStackHistory', {
      productStack: new BaselineProduct(this, 'BaselineProduct'),
      currentVersionName: 'v1',
      currentVersionLocked: true,
    });

    const product = new CloudFormationProduct(this, 'Product', {
      productName: 'BLEA Baseline',
      owner: 'Platform team at Example Company',
      productVersions: [productStackHistory.currentVersion()],
    });

    portfolio.addProduct(product);

    // Allow access to AWSControlTowerExecution role for debugging
    portfolio.giveAccessToRole(Role.fromRoleName(this, 'CTRole', 'AWSControlTowerExecution'));
  }
}
