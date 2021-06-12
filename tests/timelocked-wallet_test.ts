import { Clarinet, Tx, Chain, Account, types } from 'https://deno.land/x/clarinet@v0.10.0/index.ts';
import { assertEquals } from 'https://deno.land/std@0.90.0/testing/asserts.ts';

Clarinet.test({
	name: "Allows the contract owner to lock an amount",
	async fn(chain: Chain, accounts: Map<string, Account>) {
		const deployer = accounts.get('deployer')!;
		const beneficiary = accounts.get('wallet_1')!;
		const amount = 10;
		const block = chain.mineBlock([
			Tx.contractCall('timelocked-wallet', 'lock', [types.principal(beneficiary.address), types.uint(10), types.uint(amount)], deployer.address)
		]);
		// Preferred assertion method?
		block.receipts[0].result.expectOk().expectBool(true);
		assertEquals(block.receipts[0].result, types.ok(types.bool(true)));
		block.receipts[0].events.expectSTXTransferEvent(amount, deployer.address, `${deployer.address}.timelocked-wallet`);
	}
});

Clarinet.test({
	name: "Does not allow anyone else to lock an amount",
	async fn(chain: Chain, accounts: Map<string, Account>) {
		const accountA = accounts.get('wallet_1')!;
		const beneficiary = accounts.get('wallet_2')!;
		const block = chain.mineBlock([
			Tx.contractCall('timelocked-wallet', 'lock', [types.principal(beneficiary.address), types.uint(10), types.uint(10)], accountA.address)
		]);
		block.receipts[0].result.expectErr().expectUint(100);
	}
});

Clarinet.test({
	name: "Cannot lock more than once",
	async fn(chain: Chain, accounts: Map<string, Account>) {
		const deployer = accounts.get('deployer')!;
		const beneficiary = accounts.get('wallet_1')!;
		const amount = 10;
		const block = chain.mineBlock([
			Tx.contractCall('timelocked-wallet', 'lock', [types.principal(beneficiary.address), types.uint(10), types.uint(amount)], deployer.address),
			Tx.contractCall('timelocked-wallet', 'lock', [types.principal(beneficiary.address), types.uint(10), types.uint(amount)], deployer.address)
		]);
		block.receipts[0].result.expectOk().expectBool(true);
		block.receipts[0].events.expectSTXTransferEvent(amount, deployer.address, `${deployer.address}.timelocked-wallet`);
		block.receipts[1].result.expectErr().expectUint(101);
		assertEquals(block.receipts[1].events.length, 0);
	}
});

Clarinet.test({
	name: "Allows the beneficiary to bestow the walconst to someone else",
	async fn(chain: Chain, accounts: Map<string, Account>) {
		const deployer = accounts.get('deployer')!;
		const beneficiary = accounts.get('wallet_1')!;
		const newBeneficiary = accounts.get('wallet_2')!;
		const block = chain.mineBlock([
			Tx.contractCall('timelocked-wallet', 'lock', [types.principal(beneficiary.address), types.uint(10), types.uint(10)], deployer.address),
			Tx.contractCall('timelocked-wallet', 'bestow', [types.principal(newBeneficiary.address)], beneficiary.address)
		]);
		block.receipts.map(({ result }) => result.expectOk().expectBool(true));
	}
});

Clarinet.test({
	name: "Does not allow anyone else to bestow the walconst to someone else (not even the contract owner)",
	async fn(chain: Chain, accounts: Map<string, Account>) {
		const deployer = accounts.get('deployer')!;
		const beneficiary = accounts.get('wallet_1')!;
		const accountA = accounts.get('wallet_3')!;
		const block = chain.mineBlock([
			Tx.contractCall('timelocked-wallet', 'lock', [types.principal(beneficiary.address), types.uint(10), types.uint(10)], deployer.address),
			Tx.contractCall('timelocked-wallet', 'bestow', [types.principal(deployer.address)], deployer.address),
			Tx.contractCall('timelocked-wallet', 'bestow', [types.principal(accountA.address)], accountA.address)
		]);
		block.receipts.slice(1).map(({ result }) => result.expectErr().expectUint(104));
	}
});

Clarinet.test({
	name: "Allows the beneficiary to claim the balance when the block-height is reached",
	async fn(chain: Chain, accounts: Map<string, Account>) {
		const deployer = accounts.get('deployer')!;
		const beneficiary = accounts.get('wallet_1')!;
		const targetBlockHeight = 10;
		const amount = 10;
		chain.mineBlock([
			Tx.contractCall('timelocked-wallet', 'lock', [types.principal(beneficiary.address), types.uint(targetBlockHeight), types.uint(amount)], deployer.address),
		]);

		chain.mineEmptyBlockUntil(targetBlockHeight);

		const block = chain.mineBlock([
			Tx.contractCall('timelocked-wallet', 'claim', [], beneficiary.address),
		]);
		block.receipts[0].result.expectOk().expectBool(true);
		block.receipts[0].events.expectSTXTransferEvent(amount, `${deployer.address}.timelocked-wallet`, beneficiary.address);
	}
});

Clarinet.test({
	name: "Does not allow the beneficiary to claim the balance before the block-height is reached",
	async fn(chain: Chain, accounts: Map<string, Account>) {
		const deployer = accounts.get('deployer')!;
		const beneficiary = accounts.get('wallet_1')!;
		const targetBlockHeight = 10;
		const amount = 10;
		chain.mineBlock([
			Tx.contractCall('timelocked-wallet', 'lock', [types.principal(beneficiary.address), types.uint(targetBlockHeight), types.uint(amount)], deployer.address),
		]);

		chain.mineEmptyBlockUntil(targetBlockHeight - 1);

		const block = chain.mineBlock([
			Tx.contractCall('timelocked-wallet', 'claim', [], beneficiary.address),
		]);
		block.receipts[0].result.expectErr().expectUint(105);
		assertEquals(block.receipts[0].events.length, 0);
	}
});
