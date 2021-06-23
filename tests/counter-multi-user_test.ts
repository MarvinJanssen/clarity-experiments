import { Clarinet, Tx, Chain, Account } from 'https://deno.land/x/clarinet@v0.13.0/index.ts';

Clarinet.test({
	name: "Anyone can count up their counter",
	async fn(chain: Chain, accounts: Map<string, Account>) {
		const accountList = [accounts.get('wallet_1')!, accounts.get('wallet_2')!, accounts.get('wallet_3')!];
		const block = chain.mineBlock(
			accountList.map(account => Tx.contractCall('counter-multi-user', 'count-up', [], account.address))
		);
		block.receipts.map(receipt => receipt.result.expectOk().expectUint(1));
	}
});

Clarinet.test({
	name: "Anyone can read anyone's the current count",
	async fn(chain: Chain, accounts: Map<string, Account>) {
		const [accountA, accountB] = [accounts.get('wallet_1')!, accounts.get('wallet_2')!];
		chain.mineBlock([
			Tx.contractCall('counter-multi-user', 'count-up', [], accountA.address),
			Tx.contractCall('counter-multi-user', 'count-up', [], accountA.address),
			Tx.contractCall('counter-multi-user', 'count-up', [], accountA.address),
			Tx.contractCall('counter-multi-user', 'count-up', [], accountB.address)
		]);
		const block = chain.mineBlock([
			Tx.contractCall('counter-multi-user', 'get-count', [], accountA.address),
			Tx.contractCall('counter-multi-user', 'get-count', [], accountB.address)
		]);
		block.receipts[0].result.expectSome().expectUint(3);
		block.receipts[1].result.expectSome().expectUint(1);
	}
});

Clarinet.test({
	name: "Reading the count for a non-existent user returns none",
	async fn(chain: Chain, accounts: Map<string, Account>) {
		const accountA = accounts.get('wallet_1')!;
		const block = chain.mineBlock([
			Tx.contractCall('counter-multi-user', 'get-count', [], accountA.address),
		]);
		block.receipts[0].result.expectNone();
	}
});
