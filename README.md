# Clarity Experiments

A collection of [Clarity](https://clarity-lang.org) smart contract experiments
by [Marvin Janssen](https://twitter.com/MarvinJanssen). They run on the
[Stacks blockchain](https://stacks.co).

More documentation forthcoming. Until then, take a look at the
[unit tests](tests/) on how to use the contracts.

## Smart contracts

### [Counter](contracts/counter.clar)

A basic counter contract.

### [Counter (multi-user)](contracts/counter-multi-user.clar)

A multiuser version of the counter contract.

### [Timelocked Wallet](contracts/timelocked-wallet.clar)

A time-locked vault contract that becomes eligible to claim by the beneficiary
after a certain block-height has been reached.

### [Timelocked Wallet (simplified)](contracts/timelocked-wallet-simplified.clar)

A simplified version of the timelocked-wallet contract that uses top-level
defines.

### [Multisig Vault](contracts/multisig-vault.clar)

A simple multisig vault that allows members to vote on who should receive the
STX contents.

### [SIP009 NFT](contracts/sip009-nft.clar)

A SIP009-compliant NFT with a mint function.

### [SIP010 Fungible Token](contracts/sip010-token.clar)

A SIP010-compliant fungible token with a mint function.

### [Tiny Market](contracts/tiny-market.clar)

A tiny NFT marketplace (<100 lines of code!) that allows users to list NFTs for
sale for a fixed price. Users request payment in either STX or a
SIP010-compliant fungible token.

The maker can specify the following when listing:

- The NFT token to sell.
- Listing expiry in block height.
- The payment asset, either STX or a SIP010 fungible token.
- The NFT price in said payment asset.
- An optional intended taker. If set, only that principal will be able to
  fulfill the listing. (Useful if you want to trustlessly sell an NFT to someone
  specific.)

NFTs are transferred to the market contract when listed. The maker can get it
back at any time by cancelling the listing. If the listing expires, the maker
can likewise retrieve the NFT by cancelling.

When the taker fulfills the listing, the payment asset is transferred to the
maker directly. If all goes well, the NFT is released to the taker.
