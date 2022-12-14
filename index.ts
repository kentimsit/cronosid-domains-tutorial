import { ethers } from "ethers";
import * as sha3 from "js-sha3";
import * as uts46 from "idna-uts46-hx";

// Broadly speaking, Cronos ID works in a way that is similar to other EVM
// domain systems like ENS.
// You may refer to the ENS docs for more details: https://docs.ens.domains/

//
// ********************************************************************************
//

// Configured constants

// Here we are importing extracts of the ABIs of the relevant smart contracts

const jsonRpcUrl = "https://evm.cronos.org";

// This is the hardcoded address of the smart contract which supports the Cronosid.xyz storefront
const mintingContractAddress = "0xAfF2b5CF1950E8Fb22907CcD643728a5Dc75278B";
// This is the hash of the event generated by the contract when a new domain is minted
const mintingEventSignatureHash =
  "0x69e37f151eb98a09618ddaa80c8cfaf1ce5996867c489f45b555b412271ebf27";
// Hardcoded address of the registry smart contract:
const registryContractAddress = "0x7F4C61116729d5b27E5f180062Fdfbf32E9283E5";

// Registry smart contract

const registryContractAbi = [
  {
    constant: true,
    inputs: [
      {
        internalType: "bytes32",
        name: "node",
        type: "bytes32",
      },
    ],
    name: "resolver",
    outputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
    ],
    payable: false,
    stateMutability: "view",
    type: "function",
  },
  {
    constant: true,
    inputs: [
      {
        internalType: "bytes32",
        name: "node",
        type: "bytes32",
      },
    ],
    name: "owner",
    outputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
    ],
    payable: false,
    stateMutability: "view",
    type: "function",
  },
];

// // Resolver smart contract

const resolverContractAbi = [
  {
    constant: true,
    inputs: [
      {
        internalType: "bytes32",
        name: "",
        type: "bytes32",
      },
    ],
    name: "name",
    outputs: [
      {
        internalType: "string",
        name: "",
        type: "string",
      },
    ],
    payable: false,
    stateMutability: "view",
    type: "function",
  },
];

// Utility functions to convert a domain name into ENS namehash
// credit to https://github.com/Arachnid/eth-ens-namehash

const normalize = (name: string): string => {
  return name
    ? // @ts-ignore
      uts46.toUnicode(name, { useStd3ASCII: true, transitional: false })
    : name;
};

const namehash = (inputName: string): string => {
  // Reject empty names:
  let node = "";
  for (var i = 0; i < 32; i++) {
    node += "00";
  }

  let name = normalize(inputName);

  if (name) {
    let labels = name.split(".");

    for (let i = labels.length - 1; i >= 0; i--) {
      let labelSha = sha3.keccak_256(labels[i]);
      node = sha3.keccak_256(Buffer.from(node + labelSha, "hex"));
    }
  }

  return "0x" + node;
};

// The following is a small utility to determine if an address
// is a smart contract address on the Cronos chain, as opposed to EOA (externally owned account).
// This is important because, while the owner of a EOA address controls the private keys
// of this address on every EVM chain (and therefore, the domain <> address mapping is valid on every chain),
// a smart contract may not exist at the same address on every chain.
// For example, multi signature smart contracts usually exist on one chain only,
// and if funds are sent to the wrong chain, the funds are lost forever.

const isSmartContractAddress = async (address: string): Promise<boolean> => {
  const ethersProvider = new ethers.providers.JsonRpcProvider(jsonRpcUrl);
  const code = await ethersProvider.getCode(address);
  if (code === "0x") {
    return false;
  } else {
    return true;
  }
};

// //
// // ********************************************************************************
// //

// // The purpose of this function is to list the Cronos ID domains minted
// // during a specific block range of the Cronos mainnet chain.

const listDomainsMinted = async () => {
  // Some more hardcoded values just for the tutorials
  const blockStart = 4932153;
  // Let's capture all the events matching the contract address and event signature
  const ethersProvider = new ethers.providers.JsonRpcProvider(jsonRpcUrl);
  const logs = await ethersProvider.getLogs({
    fromBlock: blockStart,
    toBlock: blockStart + 2000,
    address: mintingContractAddress,
    topics: [mintingEventSignatureHash],
  });
  for (let i = 0; i < logs.length; i++) {
    const log = logs[i];
    const dataWithout0x = log["data"].substring(2);
    const dataSpliced = dataWithout0x.match(/.{1,64}/g) || [];
    const domainName = ethers.utils.toUtf8String("0x" + dataSpliced[5]);
    console.log(
      "At block",
      log["blockNumber"],
      "this domain was minted:",
      domainName + ".cro"
    );
  }
};

//
// ********************************************************************************
//

// The purpose of the following code is to determine who is the owner
// of a given .cro domain name. This is called forward resolution.

const forwardResolution = async (domainWithoutCro: string): Promise<string> => {
  // We convert the domain name into a node (hash)
  const node = namehash(domainWithoutCro + ".cro");
  // We use ethers.js to instantiate the smart contract
  const ethersProvider = new ethers.providers.JsonRpcProvider(jsonRpcUrl);
  const ethersContract = new ethers.Contract(
    registryContractAddress,
    registryContractAbi,
    ethersProvider
  );
  const res = await ethersContract["owner"](node);
  return res;
};

//
// ********************************************************************************
//

const reverseResolution = async (owner: string): Promise<string> => {
  // First, we transform the owner's address into a domain name with the correct namespace.
  // This is just a convention set up by ENS for reverse lookup.
  const derived_domain = owner.toLowerCase().substring(2) + ".addr.reverse";
  // Calculate the node hash of the derived domain:
  const derived_node = namehash(derived_domain);
  // Then, let's query the Registry to find the address of the resolver of this domain.
  // We use ethers.js to instantiate the smart contract
  const ethersProvider = new ethers.providers.JsonRpcProvider(jsonRpcUrl);
  const ethersContract = new ethers.Contract(
    registryContractAddress,
    registryContractAbi,
    ethersProvider
  );
  // Call the 'resolver" function of the registry to find the address of the
  // resolver smart contract associated with this domain:
  const resolverContractAddress = await ethersContract["resolver"](
    derived_node
  );
  // Then instantiate the resolver smart contract:
  const ethersResolverContract = new ethers.Contract(
    resolverContractAddress,
    resolverContractAbi,
    ethersProvider
  );
  // Let's call the 'name' function of the resolver in order to find the corresponding domain:
  const res = await ethersResolverContract["name"](derived_node);
  return res;
};

// The purpose of the following code is to query the reverse registry in order to
// determine the domain associated with a wallet address, if it exists (happy path only).
// Per ENS guidelines, one must always check the forward registry to confirm that the
// address does own the corresponding domain name. Reverse resolution is not sufficient.

//
// ********************************************************************************
//

const main = async () => {
  console.log("\n\nFirst let's have some fun.");
  console.log(
    "\n\nWe are going to monitor the new domains minted within a specific block range."
  );
  console.log("(You can customize the block range manually in the code.)");
  await listDomainsMinted();
  const domainwithoutCro = "web3developer";
  console.log(
    "\n\nNow, let's find the owner of domain",
    domainwithoutCro + ".cro"
  );
  const owner = await forwardResolution(domainwithoutCro);
  console.log("The owner of", domainwithoutCro + ".cro", "is", owner);
  console.log(
    "\nLet's check if this is a EOA address or a smart contract address"
  );
  if (await isSmartContractAddress(owner)) {
    console.log(
      "This is a smart contract address. Beware as it may not exist on every EVM chain."
    );
  } else {
    console.log(
      "This is a EOA address on Cronos chain, its owner controls the same address on every EVM chain."
    );
  }
  console.log(
    "\n\nNow we are going to reverse resolve the domain address of wallet",
    owner
  );
  const reverseResolvedDomain = await reverseResolution(owner);
  console.log(
    "The domain returned by the reverse resolution is",
    reverseResolvedDomain
  );
  console.log(
    "\n\nBut we must complete the forward resolution too, as reverse resolution is not secure enough"
  );
  const reverseResolvedDomainWithoutCro = reverseResolvedDomain.replace(
    ".cro",
    ""
  );
  const ownerVerification = await forwardResolution(
    reverseResolvedDomainWithoutCro
  );
  console.log(
    "The forward resolution of domain",
    reverseResolvedDomainWithoutCro,
    "returns",
    ownerVerification
  );
  if (owner.toLowerCase() === ownerVerification.toLowerCase()) {
    console.log(
      "=> All good, we have verified that",
      owner,
      "is indeed the owner of",
      reverseResolvedDomain
    );
  } else {
    console.log(
      "=> Not good, the forward resolution is not consistent with the forward resolution"
    );
  }
  console.log("\nAnd we are done!");
};

main();
