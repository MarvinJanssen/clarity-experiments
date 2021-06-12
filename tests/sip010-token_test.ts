import { Clarinet, Tx, Chain, Account, types } from 'https://deno.land/x/clarinet@v0.10.0/index.ts';
import { assertEquals } from 'https://deno.land/std@0.90.0/testing/asserts.ts';

const contractName = 'sip010-token';
const assetId = 'amazing-coin';

const readOnlyFnExpectOk = (chain: Chain, method: string, sender: string) => chain.callReadOnlyFn(contractName, method, [], sender).result.expectOk();

Clarinet.test({
	name: "Contract owner can mint",
	async fn(chain: Chain, accounts: Map<string, Account>) {
		const deployer = accounts.get('deployer')!;
		const amount = 5000;
		const block = chain.mineBlock([
			Tx.contractCall(contractName, 'mint', [types.uint(amount), types.principal(deployer.address)], deployer.address)
		]);
		block.receipts[0].result.expectOk().expectBool(true);
		block.receipts[0].events.expectFungibleTokenMintEvent(amount, deployer.address, assetId);
	}
});

Clarinet.test({
	name: "Non contract owner cannot mint",
	async fn(chain: Chain, accounts: Map<string, Account>) {
		const accountA = accounts.get('wallet_1')!;
		const amount = 5000;
		const block = chain.mineBlock([
			Tx.contractCall(contractName, 'mint', [types.uint(amount), types.principal(accountA.address)], accountA.address)
		]);
		block.receipts[0].result.expectErr().expectUint(100);
		assertEquals(block.receipts[0].events.length, 0);
	}
});

Clarinet.test({
	name: "Can get token name",
	async fn(chain: Chain, accounts: Map<string, Account>) {
		readOnlyFnExpectOk(chain, 'get-name', accounts.get('deployer')!.address).expectAscii("Amazing Coin");
	}
});

Clarinet.test({
	name: "Can get token symbol",
	async fn(chain: Chain, accounts: Map<string, Account>) {
		readOnlyFnExpectOk(chain, 'get-symbol', accounts.get('deployer')!.address).expectAscii("AC");
	}
});

Clarinet.test({
	name: "Can get total supply",
	async fn(chain: Chain, accounts: Map<string, Account>) {
		const deployer = accounts.get('deployer')!;
		const amount = 5000;
		chain.mineBlock([
			Tx.contractCall(contractName, 'mint', [types.uint(amount), types.principal(deployer.address)], deployer.address)
		]);
		readOnlyFnExpectOk(chain, 'get-total-supply', accounts.get('deployer')!.address).expectUint(amount);
	}
});

Clarinet.test({
	name: "Does not have a token URI",
	async fn(chain: Chain, accounts: Map<string, Account>) {
		readOnlyFnExpectOk(chain, 'get-token-uri', accounts.get('deployer')!.address).expectNone();
	}
});

Clarinet.test({
	name: "Token owner can transfer tokens",
	async fn(chain: Chain, accounts: Map<string, Account>) {
		const deployer = accounts.get('deployer')!;
		const [accountA, accountB] = ['wallet_1', 'wallet_2'].map(name => accounts.get(name)!);
		const amount = 5000;
		const block = chain.mineBlock([
			Tx.contractCall(contractName, 'mint', [types.uint(amount), types.principal(accountA.address)], deployer.address),
			Tx.contractCall(contractName, 'transfer', [types.uint(amount), types.principal(accountA.address), types.principal(accountB.address)], accountA.address)
		]);
		block.receipts[1].result.expectOk().expectBool(true);
		block.receipts[1].events.expectFungibleTokenTransferEvent(amount, accountA.address, accountB.address, assetId);
	}
});

Clarinet.test({
	name: "Cannot transfer tokens not owned by the sender",
	async fn(chain: Chain, accounts: Map<string, Account>) {
		const deployer = accounts.get('deployer')!;
		const [accountA, accountB] = ['wallet_1', 'wallet_2'].map(name => accounts.get(name)!);
		const amount = 5000;
		const block = chain.mineBlock([
			Tx.contractCall(contractName, 'mint', [types.uint(amount), types.principal(accountA.address)], deployer.address),
			Tx.contractCall(contractName, 'transfer', [types.uint(amount), types.principal(accountA.address), types.principal(accountB.address)], accountB.address)
		]);
		block.receipts[1].result.expectErr().expectUint(102);
		assertEquals(block.receipts[1].events.length, 0);
	}
});

Clarinet.test({
	name: "Cannot transfer amount that exceeds balance",
	async fn(chain: Chain, accounts: Map<string, Account>) {
		const deployer = accounts.get('deployer')!;
		const [accountA, accountB] = ['wallet_1', 'wallet_2'].map(name => accounts.get(name)!);
		const amount = 5000;
		const block = chain.mineBlock([
			Tx.contractCall(contractName, 'mint', [types.uint(amount), types.principal(accountA.address)], deployer.address),
			Tx.contractCall(contractName, 'transfer', [types.uint(amount * 2), types.principal(accountA.address), types.principal(accountB.address)], accountA.address)
		]);
		block.receipts[1].result.expectErr().expectUint(1);
		assertEquals(block.receipts[1].events.length, 0);
	}
});