import { test, expect, Tags, testTimeouts, Users, Accounts, Contracts, Products, AmendmentOpportunities, DiabetesLineEdits } from '@fixtures';

test.describe('GCRM : Amendment - Add-On Membership (Diabetes Management)', { tag: [Tags.gcrm, '@Amendment', '@addOnMembership'] }, () => {
  test.setTimeout(testTimeouts.standard);

  test('should complete add-on membership amendment for Diabetes Management', async ({ 
    login, 
    accounts, 
    manageInstallBase,
    editQuote,
    quote,
    amendmentOpportunity 
  }) => {
    const user = Users.adminUser;
    const account = Accounts.accountWithContract;
    const contract = Contracts.recurringServicesContract;
    const product = Products.diabetesManagementProduct;
    const opportunityData = AmendmentOpportunities.amendmentOpportunityData;
    const lineEditData = DiabetesLineEdits.diabetesLineEditData;

    await test.step('Login as Admin user to GCRM', async () => {
      await login.goto(process.env.GCRM_URL || 'https://gcrm.example.com');
      await login.login(user.username, user.password);
      await expect(login.getHomeIndicator()).toBeVisible();
    });

    await test.step('Navigate to Account page', async () => {
      await accounts.goto(`/accounts/${account.name}`);
      await expect(accounts.accountDetailHeading).toContainText(account.name);
    });

    await test.step('Amend contract for Recurring Services by choosing Change order on Manage Install Base dialog', async () => {
      await accounts.openManageInstallBase();
      await expect(manageInstallBase.manageInstallBaseDialog).toBeVisible();
      await manageInstallBase.selectContractTypeAndAmend(contract.type, 'Change order');
      await expect(editQuote.editQuotePageHeading).toBeVisible();
    });

    await test.step('Exit from Edit Quote page and navigate to quote page', async () => {
      await editQuote.exitToQuotePage();
      await expect(quote.getQuotePageHeading()).toBeVisible();
    });

    await test.step('Navigate to Amendment Opportunity from quote page and update fields', async () => {
      await quote.navigateToAmendmentOpportunity();
      await expect(amendmentOpportunity.opportunityPageHeading).toBeVisible();
      
      await amendmentOpportunity.updateSubtype(opportunityData.subtype);
      await amendmentOpportunity.updateNumberOfLives(opportunityData.numberOfLives);
      await amendmentOpportunity.updateSubTypeDetail(opportunityData.subTypeDetail);
      
      await expect(amendmentOpportunity.subTypeDetailDisplay).toHaveText(opportunityData.subTypeDetail);
    });

    await test.step('Navigate to Quote page from Opportunity page', async () => {
      await amendmentOpportunity.navigateToQuote();
      await expect(quote.getQuotePageHeading()).toBeVisible();
    });

    await test.step('Navigate to Edit Quote page and add Diabetes Management product', async () => {
      await quote.navigateToEditQuote();
      await expect(editQuote.editQuotePageHeading).toBeVisible();
      
      await editQuote.addProduct(product.name);
      await expect(editQuote.getNetARRField(product.name, 'new')).toBeVisible();
    });

    await test.step('Edit the new Diabetes Management line and update Per Unit Discount to -3', async () => {
      await editQuote.editProductLine(product.name, 'new');
      await editQuote.updatePerUnitDiscount(lineEditData.perUnitDiscount);
      
      await expect(editQuote.getNetARRField(product.name, 'new')).toHaveText(lineEditData.expectedNetARR);
      await expect(editQuote.getParticipantQuantityField(product.name, 'new')).toHaveText(lineEditData.expectedParticipantQuantity);
      await expect(editQuote.getQuantityField(product.name, 'new')).toHaveText(lineEditData.expectedQuantity);
      await expect(editQuote.getSubscriptionFeeField(product.name, 'new')).toHaveText(lineEditData.expectedSubscriptionFee);
    });

    await test.step('Type N/A in Reason for Approval field and save, then submit the quote for Approval', async () => {
      await editQuote.saveWithReasonForApproval('N/A');
      await editQuote.submitForApproval();
      await expect(quote.getQuotePageHeading()).toBeVisible();
    });

    await test.step('Navigate to Amendment Opportunity from quote page and verify final values', async () => {
      await quote.navigateToAmendmentOpportunity();
      
      await expect(amendmentOpportunity.subTypeDetailDisplay).toHaveText('Add-On Membership');
      await expect(amendmentOpportunity.bookingsTotalDisplay).toHaveText('USD 7,020.00');
    });
  });
});
