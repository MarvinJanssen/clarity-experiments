import { Clarinet, Tx, Chain, Account, types } from 'https://deno.land/x/clarinet@v0.10.0/index.ts';
import { assertEquals } from 'https://deno.land/std@0.90.0/testing/asserts.ts';

const contractName = 'tiny-market';

const defaultNftAssetContract = 'sip009-nft';
const defaultPaymentAssetContract = 'sip010-token';

const contractPrincipal = (deployer: Account) => `${deployer.address}.${contractName}`;

function mintNft({ chain, deployer, recipient, nftAssetContract = defaultNftAssetContract }: { chain: Chain, deployer: Account, recipient: Account, nftAssetContract?: string }) {
	const block = chain.mineBlock([
		Tx.contractCall(nftAssetContract, 'mint', [types.principal(recipient.address)], deployer.address),
	]);
	block.receipts[0].result.expectOk();
	const nftMintEvent = block.receipts[0].events[0].nft_mint_event;
	const [nftAssetContractPrincipal, nftAssetId] = nftMintEvent.asset_identifier.split('::');
	return { nftAssetContract: nftAssetContractPrincipal, nftAssetId, tokenId: nftMintEvent.value.UInt, block };
}

function mintFt({ chain, deployer, amount, recipient, paymentAssetContract = defaultPaymentAssetContract }: { chain: Chain, deployer: Account, amount: number, recipient: Account, paymentAssetContract?: string }) {
	const block = chain.mineBlock([
		Tx.contractCall(paymentAssetContract, 'mint', [types.uint(amount), types.principal(recipient.address)], deployer.address),
	]);
	block.receipts[0].result.expectOk();
	const ftMintEvent = block.receipts[0].events[0].ft_mint_event;
	const [paymentAssetContractPrincipal, paymentAssetId] = ftMintEvent.asset_identifier.split('::');
	return { paymentAssetContract: paymentAssetContractPrincipal, paymentAssetId, block };
}

interface Sip009NftTransferEvent {
	type: string,
	nft_transfer_event: {
		asset_identifier: string,
		sender: string,
		recipient: string,
		value: { UInt: number }
	}
}

function assertNftTransfer(event: Sip009NftTransferEvent, nftAssetContract: string, tokenId: number, sender: string, recipient: string) {
	assertEquals(typeof event, 'object');
	assertEquals(event.type, 'nft_transfer_event');
	assertEquals(event.nft_transfer_event.asset_identifier.substr(0, nftAssetContract.length), nftAssetContract);
	assertEquals(event.nft_transfer_event.sender, sender);
	assertEquals(event.nft_transfer_event.recipient, recipient);
	assertEquals(event.nft_transfer_event.value.UInt, tokenId);
}

interface Order {
	taker?: string,
	tokenId: number,
	expiry: number,
	price: number,
	paymentAssetContract?: string
}

const makeOrder = (order: Order) =>
	types.tuple({
		'taker': order.taker ? types.some(types.principal(order.taker)) : types.none(),
		'token-id': types.uint(order.tokenId),
		'expiry': types.uint(order.expiry),
		'price': types.uint(order.price),
		'payment-asset-contract': order.paymentAssetContract ? types.some(types.principal(order.paymentAssetContract)) : types.none(),
	});

const listOrderTx = (nftAssetContract: string, maker: Account, order: Order | string) =>
	Tx.contractCall(contractName, 'list-asset', [types.principal(nftAssetContract), typeof order === 'string' ? order : makeOrder(order)], maker.address);

Clarinet.test({
	name: "Can list an NFT for sale for STX",
	async fn(chain: Chain, accounts: Map<string, Account>) {
		const [deployer, maker] = ['deployer', 'wallet_1'].map(name => accounts.get(name)!);
		const { nftAssetContract, tokenId } = mintNft({ chain, deployer, recipient: maker });
		const order: Order = { tokenId, expiry: 10, price: 10 };
		const block = chain.mineBlock([
			listOrderTx(nftAssetContract, maker, order)
		]);
		block.receipts[0].result.expectOk().expectUint(0);
		assertNftTransfer(block.receipts[0].events[0], nftAssetContract, tokenId, maker.address, contractPrincipal(deployer));
	}
});

Clarinet.test({
	name: "Can list an NFT for sale for any SIP010 fungible token",
	async fn(chain: Chain, accounts: Map<string, Account>) {
		const [deployer, maker] = ['deployer', 'wallet_1'].map(name => accounts.get(name)!);
		const { nftAssetContract, tokenId } = mintNft({ chain, deployer, recipient: maker });
		const { paymentAssetContract } = mintFt({ chain, deployer, recipient: maker, amount: 1 });
		const order: Order = { tokenId, expiry: 10, price: 10, paymentAssetContract };
		const block = chain.mineBlock([
			listOrderTx(nftAssetContract, maker, order)
		]);
		block.receipts[0].result.expectOk().expectUint(0);
		assertNftTransfer(block.receipts[0].events[0], nftAssetContract, tokenId, maker.address, contractPrincipal(deployer));
	}
});

Clarinet.test({
	name: "Cannot list an NFT for sale if the expiry is in the past",
	async fn(chain: Chain, accounts: Map<string, Account>) {
		const [deployer, maker] = ['deployer', 'wallet_1'].map(name => accounts.get(name)!);
		const { nftAssetContract, tokenId } = mintNft({ chain, deployer, recipient: maker });
		const expiry = 10;
		const order: Order = { tokenId, expiry, price: 10 };
		chain.mineEmptyBlockUntil(expiry + 1);
		const block = chain.mineBlock([
			listOrderTx(nftAssetContract, maker, order)
		]);
		block.receipts[0].result.expectErr().expectUint(1000);
		assertEquals(block.receipts[0].events.length, 0);
	}
});

Clarinet.test({
	name: "Cannot list an NFT for sale for nothing",
	async fn(chain: Chain, accounts: Map<string, Account>) {
		const [deployer, maker] = ['deployer', 'wallet_1'].map(name => accounts.get(name)!);
		const { nftAssetContract, tokenId } = mintNft({ chain, deployer, recipient: maker });
		const order: Order = { tokenId, expiry: 10, price: 0 };
		const block = chain.mineBlock([
			listOrderTx(nftAssetContract, maker, order)
		]);
		block.receipts[0].result.expectErr().expectUint(1001);
		assertEquals(block.receipts[0].events.length, 0);
	}
});

Clarinet.test({
	name: "Cannot list an NFT for sale that the sender does not own",
	async fn(chain: Chain, accounts: Map<string, Account>) {
		const [deployer, maker, taker] = ['deployer', 'wallet_1', 'wallet_2'].map(name => accounts.get(name)!);
		const { nftAssetContract, tokenId } = mintNft({ chain, deployer, recipient: taker });
		const order: Order = { tokenId, expiry: 10, price: 10 };
		const block = chain.mineBlock([
			listOrderTx(nftAssetContract, maker, order)
		]);
		block.receipts[0].result.expectErr().expectUint(1);
		assertEquals(block.receipts[0].events.length, 0);
	}
});

Clarinet.test({
	name: "Maker can cancel a listing",
	async fn(chain: Chain, accounts: Map<string, Account>) {
		const [deployer, maker] = ['deployer', 'wallet_1'].map(name => accounts.get(name)!);
		const { nftAssetContract, tokenId } = mintNft({ chain, deployer, recipient: maker });
		const order: Order = { tokenId, expiry: 10, price: 10 };
		const block = chain.mineBlock([
			listOrderTx(nftAssetContract, maker, order),
			Tx.contractCall(contractName, 'cancel-listing', [types.uint(0), types.principal(nftAssetContract)], maker.address)
		]);
		block.receipts[1].result.expectOk().expectBool(true);
		assertNftTransfer(block.receipts[1].events[0], nftAssetContract, tokenId, contractPrincipal(deployer), maker.address);
	}
});

Clarinet.test({
	name: "Non-maker cannot cancel listing",
	async fn(chain: Chain, accounts: Map<string, Account>) {
		const [deployer, maker, otherAccount] = ['deployer', 'wallet_1', 'wallet_2'].map(name => accounts.get(name)!);
		const { nftAssetContract, tokenId } = mintNft({ chain, deployer, recipient: maker });
		const order: Order = { tokenId, expiry: 10, price: 10 };
		const block = chain.mineBlock([
			listOrderTx(nftAssetContract, maker, order),
			Tx.contractCall(contractName, 'cancel-listing', [types.uint(0), types.principal(nftAssetContract)], otherAccount.address)
		]);
		block.receipts[1].result.expectErr().expectUint(2001);
		assertEquals(block.receipts[1].events.length, 0);
	}
});

Clarinet.test({
	name: "Can get listings that have not been cancelled",
	async fn(chain: Chain, accounts: Map<string, Account>) {
		const [deployer, maker] = ['deployer', 'wallet_1'].map(name => accounts.get(name)!);
		const { nftAssetContract, tokenId } = mintNft({ chain, deployer, recipient: maker });
		const order: Order = { tokenId, expiry: 10, price: 10 };
		const block = chain.mineBlock([
			listOrderTx(nftAssetContract, maker, order)
		]);
		const listingIdUint = block.receipts[0].result.expectOk();
		const receipt = chain.callReadOnlyFn(contractName, 'get-listing', [listingIdUint], deployer.address);
		const listing: { [key: string]: string } = receipt.result.expectSome().expectTuple() as any;

		listing['expiry'].expectUint(order.expiry);
		listing['maker'].expectPrincipal(maker.address);
		listing['payment-asset-contract'].expectNone();
		listing['price'].expectUint(order.price);
		listing['taker'].expectNone();
		listing['nft-asset-contract'].expectPrincipal(nftAssetContract);
		listing['token-id'].expectUint(tokenId);
	}
});

Clarinet.test({
	name: "Cannot get listings that have been cancelled or do not exist",
	async fn(chain: Chain, accounts: Map<string, Account>) {
		const [deployer, maker] = ['deployer', 'wallet_1'].map(name => accounts.get(name)!);
		const { nftAssetContract, tokenId } = mintNft({ chain, deployer, recipient: maker });
		const order: Order = { tokenId, expiry: 10, price: 10 };
		chain.mineBlock([
			listOrderTx(nftAssetContract, maker, order),
			Tx.contractCall(contractName, 'cancel-listing', [types.uint(0), types.principal(nftAssetContract)], maker.address)
		]);
		const receipts = [types.uint(0), types.uint(999)].map(listingId => chain.callReadOnlyFn(contractName, 'get-listing', [listingId], deployer.address));
		receipts.map(receipt => receipt.result.expectNone());
	}
});

Clarinet.test({
	name: "Can fulfill an active listing with STX",
	async fn(chain: Chain, accounts: Map<string, Account>) {
		const [deployer, maker, taker] = ['deployer', 'wallet_1', 'wallet_2'].map(name => accounts.get(name)!);
		const { nftAssetContract, tokenId } = mintNft({ chain, deployer, recipient: maker });
		const order: Order = { tokenId, expiry: 10, price: 10 };
		const block = chain.mineBlock([
			listOrderTx(nftAssetContract, maker, order),
			Tx.contractCall(contractName, 'fulfill-listing-stx', [types.uint(0), types.principal(nftAssetContract)], taker.address)
		]);
		block.receipts[1].result.expectOk().expectUint(0);
		assertNftTransfer(block.receipts[1].events[0], nftAssetContract, tokenId, contractPrincipal(deployer), taker.address);
		block.receipts[1].events.expectSTXTransferEvent(order.price, taker.address, maker.address);
	}
});

Clarinet.test({
	name: "Can fulfill an active listing with SIP010 fungible tokens",
	async fn(chain: Chain, accounts: Map<string, Account>) {
		const [deployer, maker, taker] = ['deployer', 'wallet_1', 'wallet_2'].map(name => accounts.get(name)!);
		const price = 50;
		const { nftAssetContract, tokenId } = mintNft({ chain, deployer, recipient: maker });
		const { paymentAssetContract, paymentAssetId } = mintFt({ chain, deployer, recipient: taker, amount: price });
		const order: Order = { tokenId, expiry: 10, price, paymentAssetContract };
		const block = chain.mineBlock([
			listOrderTx(nftAssetContract, maker, order),
			Tx.contractCall(contractName, 'fulfill-listing-ft', [types.uint(0), types.principal(nftAssetContract), types.principal(paymentAssetContract)], taker.address)
		]);
		block.receipts[1].result.expectOk().expectUint(0);
		assertNftTransfer(block.receipts[1].events[0], nftAssetContract, tokenId, contractPrincipal(deployer), taker.address);
		block.receipts[1].events.expectFungibleTokenTransferEvent(price, taker.address, maker.address, paymentAssetId);
	}
});

Clarinet.test({
	name: "Cannot fulfill own listing",
	async fn(chain: Chain, accounts: Map<string, Account>) {
		const [deployer, maker] = ['deployer', 'wallet_1'].map(name => accounts.get(name)!);
		const { nftAssetContract, tokenId } = mintNft({ chain, deployer, recipient: maker });
		const order: Order = { tokenId, expiry: 10, price: 10 };
		const block = chain.mineBlock([
			listOrderTx(nftAssetContract, maker, order),
			Tx.contractCall(contractName, 'fulfill-listing-stx', [types.uint(0), types.principal(nftAssetContract)], maker.address)
		]);
		block.receipts[1].result.expectErr().expectUint(2005);
		assertEquals(block.receipts[1].events.length, 0);
	}
});

Clarinet.test({
	name: "Cannot fulfill an unknown listing",
	async fn(chain: Chain, accounts: Map<string, Account>) {
		const [deployer, maker, taker] = ['deployer', 'wallet_1', 'wallet_2'].map(name => accounts.get(name)!);
		const { nftAssetContract } = mintNft({ chain, deployer, recipient: maker });
		const block = chain.mineBlock([
			Tx.contractCall(contractName, 'fulfill-listing-stx', [types.uint(0), types.principal(nftAssetContract)], taker.address)
		])
		block.receipts[0].result.expectErr().expectUint(2000);
		assertEquals(block.receipts[0].events.length, 0);
	}
});

Clarinet.test({
	name: "Cannot fulfill an expired listing",
	async fn(chain: Chain, accounts: Map<string, Account>) {
		const [deployer, maker, taker] = ['deployer', 'wallet_1', 'wallet_2'].map(name => accounts.get(name)!);
		const expiry = 10;
		const { nftAssetContract, tokenId } = mintNft({ chain, deployer, recipient: maker });
		const order: Order = { tokenId, expiry, price: 10 };
		chain.mineBlock([
			listOrderTx(nftAssetContract, maker, order),
		]);
		chain.mineEmptyBlockUntil(expiry + 1);
		const block = chain.mineBlock([
			Tx.contractCall(contractName, 'fulfill-listing-stx', [types.uint(0), types.principal(nftAssetContract)], taker.address)
		])
		block.receipts[0].result.expectErr().expectUint(2002);
		assertEquals(block.receipts[0].events.length, 0);
	}
});

Clarinet.test({
	name: "Cannot fulfill a listing with a different NFT contract reference",
	async fn(chain: Chain, accounts: Map<string, Account>) {
		const [deployer, maker, taker] = ['deployer', 'wallet_1', 'wallet_2'].map(name => accounts.get(name)!);
		const expiry = 10;
		const { nftAssetContract, tokenId } = mintNft({ chain, deployer, recipient: maker });
		const order: Order = { tokenId, expiry, price: 10 };
		const bogusNftAssetContract = `${deployer.address}.bogus-nft`;
		const block = chain.mineBlock([
			listOrderTx(nftAssetContract, maker, order),
			Tx.contractCall(contractName, 'fulfill-listing-stx', [types.uint(0), types.principal(bogusNftAssetContract)], taker.address)
		]);
		block.receipts[1].result.expectErr().expectUint(2003);
		assertEquals(block.receipts[1].events.length, 0);
	}
});

Clarinet.test({
	name: "Cannot fulfill an active STX listing with SIP010 fungible tokens",
	async fn(chain: Chain, accounts: Map<string, Account>) {
		const [deployer, maker, taker] = ['deployer', 'wallet_1', 'wallet_2'].map(name => accounts.get(name)!);
		const price = 50;
		const { nftAssetContract, tokenId } = mintNft({ chain, deployer, recipient: maker });
		const { paymentAssetContract } = mintFt({ chain, deployer, recipient: taker, amount: price });
		const order: Order = { tokenId, expiry: 10, price };
		const block = chain.mineBlock([
			listOrderTx(nftAssetContract, maker, order),
			Tx.contractCall(contractName, 'fulfill-listing-ft', [types.uint(0), types.principal(nftAssetContract), types.principal(paymentAssetContract)], taker.address)
		]);
		block.receipts[1].result.expectErr().expectUint(2004);
		assertEquals(block.receipts[1].events.length, 0);
	}
});

Clarinet.test({
	name: "Cannot fulfill an active SIP010 fungible tokens listing with STX",
	async fn(chain: Chain, accounts: Map<string, Account>) {
		const [deployer, maker, taker] = ['deployer', 'wallet_1', 'wallet_2'].map(name => accounts.get(name)!);
		const price = 50;
		const { nftAssetContract, tokenId } = mintNft({ chain, deployer, recipient: maker });
		const { paymentAssetContract } = mintFt({ chain, deployer, recipient: taker, amount: price });
		const order: Order = { tokenId, expiry: 10, price, paymentAssetContract };
		const block = chain.mineBlock([
			listOrderTx(nftAssetContract, maker, order),
			Tx.contractCall(contractName, 'fulfill-listing-stx', [types.uint(0), types.principal(nftAssetContract)], taker.address)
		]);
		block.receipts[1].result.expectErr().expectUint(2004);
		assertEquals(block.receipts[1].events.length, 0);
	}
});

Clarinet.test({
	name: "Cannot fulfill an active STX listing with insufficient balance",
	async fn(chain: Chain, accounts: Map<string, Account>) {
		const [deployer, maker, taker] = ['deployer', 'wallet_1', 'wallet_2'].map(name => accounts.get(name)!);
		const { nftAssetContract, tokenId } = mintNft({ chain, deployer, recipient: maker });
		const order: Order = { tokenId, expiry: 10, price: taker.balance + 10 };
		const block = chain.mineBlock([
			listOrderTx(nftAssetContract, maker, order),
			Tx.contractCall(contractName, 'fulfill-listing-stx', [types.uint(0), types.principal(nftAssetContract)], taker.address)
		]);
		block.receipts[1].result.expectErr().expectUint(1);
		assertEquals(block.receipts[1].events.length, 0);
	}
});

Clarinet.test({
	name: "Cannot fulfill an active SIP010 fungible tokens listing with insufficient balance",
	async fn(chain: Chain, accounts: Map<string, Account>) {
		const [deployer, maker, taker] = ['deployer', 'wallet_1', 'wallet_2'].map(name => accounts.get(name)!);
		const price = 50;
		const { nftAssetContract, tokenId } = mintNft({ chain, deployer, recipient: maker });
		const { paymentAssetContract } = mintFt({ chain, deployer, recipient: taker, amount: price });
		const order: Order = { tokenId, expiry: 10, price: taker.balance + 10, paymentAssetContract };
		const block = chain.mineBlock([
			listOrderTx(nftAssetContract, maker, order),
			Tx.contractCall(contractName, 'fulfill-listing-ft', [types.uint(0), types.principal(nftAssetContract), types.principal(paymentAssetContract)], taker.address)
		]);
		block.receipts[1].result.expectErr().expectUint(1);
		assertEquals(block.receipts[1].events.length, 0);
	}
});

Clarinet.test({
	name: "Intended taker can fulfill active listing",
	async fn(chain: Chain, accounts: Map<string, Account>) {
		const [deployer, maker, taker] = ['deployer', 'wallet_1', 'wallet_2'].map(name => accounts.get(name)!);
		const { nftAssetContract, tokenId } = mintNft({ chain, deployer, recipient: maker });
		const order: Order = { tokenId, expiry: 10, price: 10, taker: taker.address };
		const block = chain.mineBlock([
			listOrderTx(nftAssetContract, maker, order),
			Tx.contractCall(contractName, 'fulfill-listing-stx', [types.uint(0), types.principal(nftAssetContract)], taker.address)
		]);
		block.receipts[1].result.expectOk().expectUint(0);
		assertNftTransfer(block.receipts[1].events[0], nftAssetContract, tokenId, contractPrincipal(deployer), taker.address);
		block.receipts[1].events.expectSTXTransferEvent(order.price, taker.address, maker.address);
	}
});

Clarinet.test({
	name: "Unintended taker cannot fulfill active listing",
	async fn(chain: Chain, accounts: Map<string, Account>) {
		const [deployer, maker, taker, unintendedTaker] = ['deployer', 'wallet_1', 'wallet_2', 'wallet_3'].map(name => accounts.get(name)!);
		const { nftAssetContract, tokenId } = mintNft({ chain, deployer, recipient: maker });
		const order: Order = { tokenId, expiry: 10, price: 10, taker: taker.address };
		const block = chain.mineBlock([
			listOrderTx(nftAssetContract, maker, order),
			Tx.contractCall(contractName, 'fulfill-listing-stx', [types.uint(0), types.principal(nftAssetContract)], unintendedTaker.address)
		]);
		block.receipts[1].result.expectErr().expectUint(2006);
		assertEquals(block.receipts[1].events.length, 0);
	}
});