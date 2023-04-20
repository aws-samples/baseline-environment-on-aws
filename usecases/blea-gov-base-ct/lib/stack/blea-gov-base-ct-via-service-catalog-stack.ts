import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { CloudFormationProduct, Portfolio, ProductStack, ProductStackHistory } from 'aws-cdk-lib/aws-servicecatalog';
import { Iam } from '../construct/iam';
import { Logging } from '../construct/logging';
import { Detection } from '../construct/detection';
import { Role } from 'aws-cdk-lib/aws-iam';

export interface BLEAGovBaseCtScStackProps extends StackProps {
  securityNotifyEmail: string;
}

export class BLEAGovBaseCtScStack extends Stack {
  constructor(scope: Construct, id: string, props: BLEAGovBaseCtScStackProps) {
    super(scope, id, props);

    class BaselineProduct extends ProductStack {
      constructor(scope: Construct, id: string) {
        super(scope, id);

        new Iam(this, 'Iam');

        // AWS CloudTrail configuration in Control Tower Landing Zone v3.0 will not create CloudWatch Logs LogGroup in each Guest Accounts.
        // And it will delete these LogGroups when AWS CloudTrial Configuration is disabled in case of updating Landing Zone version from older one.
        // BLEA should notify their alarms continuously. So, if there is no CloudTrail and CloudWatch Logs in Guest Account, BLEA creates them to notify the Alarms.
        const logging = new Logging(this, 'Logging');

        // Security Alarms
        // !!! Need to setup SecurityHub, GuardDuty manually on Organizations Management account
        // AWS Config and CloudTrail are set up by Control Tower
        new Detection(this, 'Detection', {
          notifyEmail: props.securityNotifyEmail,
          cloudTrailLogGroupName: logging.trailLogGroup.logGroupName,
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
