# Cronos ID Domains Tutorial

Basic tutorial on how to interact with the Cronod ID domains protocol using Node (Typescript).

# Get started

Requirements:

- Node v16+

To run the demo script:

```
# Install dependencies
npm install

# Execute the script
npx ts-node index.ts

```

# What is happening

The demo script demonstrates the main ways that you may want to interact with the Cronod ID domains protocol:

- First, the script listens to the events emitted by the minting smart contract in order to find out what are some of the new domain names that have been minted within a specific block range on the Cronos mainnet chain.
- Then, the script takes an arbitrary domain name (web3developer.cro) and completes forward resolution, meaning that it queries the Cronos ID domain registry in order to determine the wallet address who is the owner of this domain.
- Finally, the script completes a reverse resolution, meaning that it uses the Cronos ID domains registry to find out what is the domain name associated with a given wallet address. As reverse resolution is not a sufficiently strong proof of ownership, the reverse resolution is followed by forward resolution, again, to check that the wallet address is indeed the owner of this domain.

To understand what's going on in more details: please review the comments in the code.
