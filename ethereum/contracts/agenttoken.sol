// SPDX-License-Identifier: MIT
// Compatible with OpenZeppelin Contracts ^5.0.0
pragma solidity ^0.8.22;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import "stl-contracts/ERC/ERC5169.sol";
import "stl-contracts/tokens/ERC721OptimizedEnumerableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract AgentToken is
    Initializable,
    ERC721OptimizedEnumerableUpgradeable,
    OwnableUpgradeable,
    UUPSUpgradeable,
    ERC5169,
    ReentrancyGuardUpgradeable
{
    string private __baseURI;
    uint256 private _currentTokenId;
    
    mapping(bytes32 => uint256) private _mintHashes;
    mapping(uint256 => bytes32) private _tokenIdToHash;

    uint256 private _tokenMintFee;
    address private _paymentTokenAddress;

    event Minted(address indexed to, uint256 indexed tokenId);
    event MintDerivative(
        address indexed to,
        uint256 indexed tokenId,
        uint256 indexed derivativeId
    );
    event MintFeeUpdated(uint256 newFee);
    event DerivativeLimitUpdated(uint256 newLimit);
    event TokenMintFeeUpdated(uint256 newFee);
    event PaymentTokenAddressUpdated(address newAddress);

    function initialize(
        string memory name,
        string memory symbol,
        address paymentTokenAddress
    ) public initializer {
        __ERC721_init(name, symbol);
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();
        __baseURI = "https://3-88-107-72.sslip.io:8443/metadata2/";
        _tokenMintFee = 1 ether;
        _currentTokenId = 0;
        _paymentTokenAddress = paymentTokenAddress;
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}

    function setBaseUri(string calldata url) public onlyOwner {
        __baseURI = url;
    }

    function getTokenMintFee() public view returns (uint256) {
        return _tokenMintFee;
    }

    function setTokenMintFee(uint256 fee) public onlyOwner {
        emit TokenMintFeeUpdated(fee);
        _tokenMintFee = fee;
    }

    function setPaymentTokenAddress(address tokenAddress) public onlyOwner {
        emit PaymentTokenAddressUpdated(tokenAddress);
        _paymentTokenAddress = tokenAddress;
    }

    function getPaymentTokenAddress() public view returns (address) {
        return _paymentTokenAddress;
    }

    function mintWithToken(bytes32 tokenHash, bytes calldata signature) public nonReentrant {
        //pay using the token. If the token cannot be transferred, the mint will fail.
        IERC20(_paymentTokenAddress).transferFrom(msg.sender, address(this), _tokenMintFee);
        uint256 tokenId = _mintToken(tokenHash, signature);
        emit Minted(msg.sender, tokenId);
    }

    function _mintToken(
        bytes32 tokenHash,
        bytes calldata signature
    ) internal returns (uint256) {
        require(_mintHashes[tokenHash] == 0, "Token already minted");
        // Split the signature into its components
        (uint8 v, bytes32 r, bytes32 s) = splitSignature(signature);

        // Recover the destination address from the signature
        address recoveredAddress = ecrecover(tokenHash, v, r, s);
        // Note: We reserve the ability for a 'paymaster' to be able to mint the tokens.
        // This means there's no check to ensure that the msg.sender is the recipient

        // Mint to the recovered address using the tokenHash and signature
        _safeMint(recoveredAddress, _currentTokenId);
        _mintHashes[tokenHash] = _currentTokenId;
        _tokenIdToHash[_currentTokenId] = tokenHash;
        return _currentTokenId++;
    }

    function splitSignature(
        bytes memory sig
    ) internal pure returns (uint8 v, bytes32 r, bytes32 s) {
        require(sig.length == 65);

        assembly {
            // first 32 bytes, after the length prefix.
            r := mload(add(sig, 32))
            // second 32 bytes.
            s := mload(add(sig, 64))
            // final byte (first byte of the next 32 bytes).
            v := byte(0, mload(add(sig, 96)))
        }

        return (v, r, s);
    }

    function getTokenIdFromHash(bytes32 hash) public view returns (uint256) {
        return _mintHashes[hash];
    }

    // function tokenURI(
    //     uint256 tokenId
    // ) public view override returns (string memory) {
    //     uint256 tokenHashValue = uint256(_tokenIdToHash[tokenId]);
    //     require(tokenHashValue != 0, "Token not minted");
    //     return
    //         string(
    //             abi.encodePacked(__baseURI, Strings.toHexString(tokenHashValue))
    //         );
    // }

    function tokenURI(
        uint256 tokenId
    ) public view override returns (string memory) {
        uint256 tokenHashValue = uint256(_tokenIdToHash[tokenId]);
        require(tokenHashValue != 0, "Token not minted");
        return
            string(
                abi.encodePacked(__baseURI, Strings.toString(tokenId))
            );
    }   

    function totalSupply() override public view returns (uint256) {
        return _currentTokenId - 1;
    }

    function _update(
        address to,
        uint256 tokenId,
        address auth
    )
        internal
        override(ERC721OptimizedEnumerableUpgradeable)
        returns (address)
    {
        return ERC721OptimizedEnumerableUpgradeable._update(to, tokenId, auth);
    }

    function supportsInterface(
        bytes4 interfaceId
    )
        public
        view
        override(
            ERC5169,
            ERC721OptimizedEnumerableUpgradeable
        )
        returns (bool)
    {
        return
            ERC721OptimizedEnumerableUpgradeable.supportsInterface(
                interfaceId
            ) || ERC5169.supportsInterface(interfaceId);
    }

    function _authorizeSetScripts(
        string[] memory
    ) internal virtual override onlyOwner {}

    uint256[48] private __gap;
}
