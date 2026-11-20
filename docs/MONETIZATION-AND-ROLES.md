# TeroLibrary — roles and monetization policy

## One account
A user starts as `reader`. The reader may activate the author role on the existing account via `POST /api/author/register`; no duplicate account is created and reader data is retained. Author activation is self-service for active reader accounts. Author APIs continue to use server-side role checks.

## Work categories
- `kind = original` and `is_classic = false`: commercially eligible. This includes original self-published books and original comics.
- `kind = fanfic`: non-commercial, regardless of format.
- `is_classic = true`: public-domain/non-commercial under platform policy.
- Publisher-managed original works may be sold by the publisher; self-published original works may be sold by their author.

## Fanfiction and public-domain works
Fanfiction and public-domain works cannot have paid chapters, book prices, or commercial sale. Voluntary donations are permitted. Donation records and existing paid entitlements are not deleted by the migration. Current active sale prices are disabled and existing paid chapter access is converted to free when the policy migration runs.

## Enforcement
The policy is enforced in chapter creation/pricing, purchase resolution (book and chapter), self-published book pricing, publisher pricing and admin pricing. Client UI is explanatory only; server checks are authoritative.

## Donations
Donations remain a voluntary support mechanism and are separate from purchases, paid chapter access, subscription revenue and royalties. Fanfic/public-domain creators may receive donations only.
