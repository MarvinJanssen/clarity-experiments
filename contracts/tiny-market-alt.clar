;; Too bad this does not seem to work because of the (optional <ft-trait>).
;; 
;; (define-private (send-payment-guarded (expected-contract-principal (optional principal)) (token-contract <ft-trait>) (amount uint) (sender principal) (recipient principal))
;; 	(begin
;; 		(asserts! (is-eq expected-contract-principal (some (contract-of token-contract))) err-payment-asset-mismatch)
;; 		(transfer-ft token-contract amount sender recipient)
;; 	)
;; )
;; 
;; (define-public (fulfill-listing-payment-asset (listing-id uint) (nft-asset-contract <nft-trait>) (payment-asset-contract (optional <ft-trait>)))
;; 	(let (
;; 		(listing (unwrap! (map-get? listings {id: listing-id}) err-unknown-listing))
;; 		(price (get price listing))
;; 		(maker (get maker listing))
;; 		(taker tx-sender)
;; 		(intended-taker (get taker listing))
;; 		)
;; 		(asserts! (not (is-eq maker taker)) err-maker-taker-equal)
;; 		(asserts! (is-eq (get nft-asset-contract listing) (contract-of nft-asset-contract)) err-nft-asset-mismatch)
;; 		(asserts! (< block-height (get expiry listing)) err-listing-expired)
;; 		(asserts! (match intended-taker intended (is-eq taker intended) true) err-unintended-taker)
;; 		(try! (as-contract (transfer-nft nft-asset-contract (get token-id listing) tx-sender taker)))
;; 		(try!
;; 			(match payment-asset-contract ft-contract
;; 				(begin ;; some
;; 					;; Fails on (contract-of ft-contract) for some reason. Bug in the REPL? How about the CVM?
;; 					;; (asserts! (is-eq (get payment-asset-contract listing) (some (contract-of ft-contract))) err-payment-asset-mismatch)
;; 					(send-payment-guarded (get payment-asset-contract listing) ft-contract price taker maker)
;; 				)
;; 				(begin ;; none
;; 					(asserts! (is-none (get payment-asset-contract listing)) err-payment-asset-mismatch)
;; 					(stx-transfer? price taker maker)
;; 				)
;; 			)
;; 		)
;; 		(map-delete listings {id: listing-id})
;; 		(ok listing-id)
;; 	)
;; )
