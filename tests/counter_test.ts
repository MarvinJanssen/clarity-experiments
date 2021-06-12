import { Clarinet, Tx, Chain, Account } from 'https://deno.land/x/clarinet@v0.10.0/index.ts';

Clarinet.test({
	name: "Owner can count up",
	async fn(chain: Chain, accounts: Map<string, Account>) {
		const deployer = accounts.get('deployer')!;
		const block = chain.mineBlock([
			Tx.contractCall('counter', 'count-up', [], deployer.address)
		]);
		block.receipts[0].result.expectOk();
	}
});

Clarinet.test({
	name: "Counting up returns the next count",
	async fn(chain: Chain, accounts: Map<string, Account>) {
		const deployer = accounts.get('deployer')!;
		const block = chain.mineBlock([
			Tx.contractCall('counter', 'count-up', [], deployer.address),
			Tx.contractCall('counter', 'count-up', [], deployer.address),
			Tx.contractCall('counter', 'count-up', [], deployer.address)
		]);
		block.receipts[0].result.expectOk().expectUint(1);
		block.receipts[1].result.expectOk().expectUint(2);
		block.receipts[2].result.expectOk().expectUint(3);
	}
});

Clarinet.test({
	name: "Non-owner cannot count up",
	async fn(chain: Chain, accounts: Map<string, Account>) {
		const accountA = accounts.get('wallet_1')!;
		const block = chain.mineBlock([
			Tx.contractCall('counter', 'count-up', [], accountA.address)
		]);
		block.receipts[0].result.expectErr().expectUint(100);
	}
});

Clarinet.test({
	name: "Anyone can read the current count",
	async fn(chain: Chain, accounts: Map<string, Account>) {
		const deployer = accounts.get('deployer')!;
		const accountA = accounts.get('wallet_1')!;
		const block = chain.mineBlock([
			Tx.contractCall('counter', 'get-count', [], deployer.address),
			Tx.contractCall('counter', 'get-count', [], accountA.address)
		]);
		block.receipts.map(receipt => receipt.result.expectUint(0));
	}
});