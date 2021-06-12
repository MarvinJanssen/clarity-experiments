import { Clarinet, Tx, Chain, Account, types } from 'https://deno.land/x/clarinet@v0.10.0/index.ts';
import { assertEquals } from 'https://deno.land/std@0.90.0/testing/asserts.ts';

const contractName = 'sip009-nft';

Clarinet.test({
	name: "Contract owner can mint",
	async fn(chain: Chain, accounts: Map<string, Account>) {
		const deployer = accounts.get('deployer')!;
		const block = chain.mineBlock([
			Tx.contractCall(contractName, 'mint', [types.principal(deployer.address)], deployer.address)
		]);
		block.receipts[0].result.expectOk().expectUint(1);
		// Following two assertions are temporary, until expectNonFungibleTokenMintEvent() becomes available.
		assertEquals(block.receipts[0].events[0].nft_mint_event.recipient, deployer.address);
		assertEquals(block.receipts[0].events[0].nft_mint_event.value.UInt, 1);
	}
});

Clarinet.test({
	name: "Non contract owner cannot mint",
	async fn(chain: Chain, accounts: Map<string, Account>) {
		const accountA = accounts.get('wallet_1')!;
		const block = chain.mineBlock([
			Tx.contractCall(contractName, 'mint', [types.principal(accountA.address)], accountA.address)
		]);
		block.receipts[0].result.expectErr().expectUint(100);
	}
});

Clarinet.test({
	name: "Can get last token ID",
	async fn(chain: Chain, accounts: Map<string, Account>) {
		const deployer = accounts.get('deployer')!;
		const accountA = accounts.get('wallet_1')!;
		chain.mineBlock([
			Tx.contractCall(contractName, 'mint', [types.principal(accountA.address)], deployer.address)
		]);
		const lastTokenId = chain.callReadOnlyFn(contractName, 'get-last-token-id', [], deployer.address);
		lastTokenId.result.expectOk().expectUint(1);
	}
});

Clarinet.test({
	name: "Can get owner of specific tokens by ID",
	async fn(chain: Chain, accounts: Map<string, Account>) {
		const deployer = accounts.get('deployer')!;
		const accountList = ['wallet_1', 'wallet_2', 'wallet_3'].map(name => accounts.get(name)!);
		const block = chain.mineBlock(
			accountList.map(account => Tx.contractCall(contractName, 'mint', [types.principal(account.address)], deployer.address))
		);
		const tokenOwners = block.receipts.map(receipt => chain.callReadOnlyFn(contractName, 'get-owner', [receipt.result.expectOk()], deployer.address));
		// The following two maps generate arrays in the form of ['ST...', 'ST...', 'ST...'] and then compares them.
		assertEquals(tokenOwners.map(receipt => receipt.result.expectOk().expectSome()), accountList.map(account => account.address));
	}
});

Clarinet.test({
	name: "Token owner can transfer tokens",
	async fn(chain: Chain, accounts: Map<string, Account>) {
		const deployer = accounts.get('deployer')!;
		const [accountA, accountB] = ['wallet_1', 'wallet_2'].map(name => accounts.get(name)!);
		const block = chain.mineBlock([
			Tx.contractCall(contractName, 'mint', [types.principal(accountA.address)], deployer.address),
			Tx.contractCall(contractName, 'transfer', [types.uint(1), types.principal(accountA.address), types.principal(accountB.address)], accountA.address)
		]);
		block.receipts[1].result.expectOk().expectBool(true);
		// Following two assertions are temporary, until expectNonFungibleTokenTransferEvent() becomes available.
		const nftTransferEvent = block.receipts[1].events[0].nft_transfer_event;
		assertEquals(nftTransferEvent.sender, accountA.address);
		assertEquals(nftTransferEvent.recipient, accountB.address);
		assertEquals(nftTransferEvent.value.UInt, 1);
	}
});

Clarinet.test({
	name: "Cannot transfer tokens not owned by sender",
	async fn(chain: Chain, accounts: Map<string, Account>) {
		const deployer = accounts.get('deployer')!;
		const [accountA, accountB] = ['wallet_1', 'wallet_2'].map(name => accounts.get(name)!);
		const block = chain.mineBlock([
			Tx.contractCall(contractName, 'mint', [types.principal(accountA.address)], deployer.address),
			Tx.contractCall(contractName, 'transfer', [types.uint(1), types.principal(accountA.address), types.principal(accountB.address)], accountB.address)
		]);
		block.receipts[1].result.expectErr().expectUint(102);
		assertEquals(block.receipts[1].events.length, 0);
	}
});

Clarinet.test({
	name: "Can get token metadata URI by token ID",
	async fn(chain: Chain, accounts: Map<string, Account>) {
		const deployer = accounts.get('deployer')!;
		const accountA = accounts.get('wallet_1')!;
		chain.mineBlock([
			Tx.contractCall(contractName, 'mint', [types.principal(accountA.address)], deployer.address)
		]);
		const tokenMetadataUri = chain.callReadOnlyFn(contractName, 'get-token-uri', [types.uint(1)], deployer.address);
		tokenMetadataUri.result.expectOk().expectSome().expectAscii("https://stacksies.com/metadata/");
		// Not until type conversions become easier in Clarity.
		//tokenMetadataUri.result.expectOk().expectSome().expectAscii("https://stacksies.com/metadata/1.json");
	}
});

Clarinet.test({
	name: "Cannot get token metadata URI for tokens that do not exist",
	async fn(chain: Chain, accounts: Map<string, Account>) {
		const deployer = accounts.get('deployer')!;
		const tokenMetadataUri = chain.callReadOnlyFn(contractName, 'get-token-uri', [types.uint(1)], deployer.address);
		tokenMetadataUri.result.expectOk().expectNone();
	}
});