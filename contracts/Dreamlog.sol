// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title RitualDreamlog
 * @notice On-chain dream journal powered by Ritual LLM Precompile (0x0802)
 * @dev Frontend calls precompile directly (EOA → 0x0802), then stores results via storeResult
 */
contract RitualDreamlog is ERC721, Ownable {

    address constant RITUAL_WALLET = 0x532F0dF0896F353d8C3DD8cc134e8129DA2a3948;

    struct Dream {
        uint256 id;
        address dreamer;
        string dreamText;
        string interpretation;
        string mood;
        string archetype;
        string emotion;
        string language;
        uint256 timestamp;
        uint256 parentDreamId;
        bool minted;
        bool interpreted;
    }

    uint256 public nextDreamId;
    uint256 public nextTokenId;
    mapping(uint256 => Dream) public dreams;
    mapping(address => uint256[]) public dreamerDreams;

    event DreamSubmitted(uint256 indexed dreamId, address indexed dreamer, string language);
    event DreamInterpreted(uint256 indexed dreamId, string mood, string archetype);
    event DreamChained(uint256 indexed dreamId, uint256 indexed parentDreamId);
    event DreamMinted(uint256 indexed dreamId, uint256 indexed tokenId, address dreamer);

    error NotYourDream();
    error NotInterpreted();
    error AlreadyMinted();
    error EmptyDreamText();

    constructor() ERC721("Ritual Dreamlog", "DREAM") Ownable(msg.sender) {}

    /**
     * @notice Submit a dream (stores text, emits event for frontend to pick up)
     * @param dreamText The dream text
     * @param language ISO language code
     * @return dreamId The unique dream ID
     */
    function submitDream(
        string calldata dreamText,
        string calldata language
    ) external returns (uint256 dreamId) {
        if (bytes(dreamText).length == 0) revert EmptyDreamText();

        dreamId = nextDreamId++;
        Dream storage dream = dreams[dreamId];
        dream.id = dreamId;
        dream.dreamer = msg.sender;
        dream.dreamText = dreamText;
        dream.language = language;
        dream.timestamp = block.timestamp;
        dream.interpreted = false;
        dream.minted = false;

        dreamerDreams[msg.sender].push(dreamId);
        emit DreamSubmitted(dreamId, msg.sender, language);
    }

    /**
     * @notice Store LLM interpretation result (called by frontend after EOA precompile call)
     * @param dreamId The dream ID
     * @param interpretation Raw interpretation text from LLM
     */
    function storeResult(
        uint256 dreamId,
        string calldata interpretation
    ) external {
        Dream storage dream = dreams[dreamId];
        if (dream.dreamer != msg.sender) revert NotYourDream();

        dream.interpretation = interpretation;
        dream.interpreted = true;

        // Parse mood from JSON
        if (_contains(interpretation, '"mood":"mystical"')) dream.mood = "mystical";
        else if (_contains(interpretation, '"mood":"dark"')) dream.mood = "dark";
        else if (_contains(interpretation, '"mood":"zen"')) dream.mood = "zen";
        else if (_contains(interpretation, '"mood":"wonder"')) dream.mood = "wonder";
        else if (_contains(interpretation, '"mood":"horror"')) dream.mood = "horror";
        else if (_contains(interpretation, '"mood":"confused"')) dream.mood = "confused";
        else dream.mood = "mystical";

        if (_contains(interpretation, '"archetype":')) {
            dream.archetype = _extractJsonString(interpretation, "archetype");
        } else {
            dream.archetype = "The Dreamer";
        }

        if (_contains(interpretation, '"emotion":')) {
            dream.emotion = _extractJsonString(interpretation, "emotion");
        } else {
            dream.emotion = "Unknown";
        }

        emit DreamInterpreted(dreamId, dream.mood, dream.archetype);
    }

    function chainDream(uint256 dreamId, uint256 parentDreamId) external {
        Dream storage dream = dreams[dreamId];
        Dream storage parent = dreams[parentDreamId];
        if (dream.dreamer != msg.sender) revert NotYourDream();
        if (parent.dreamer != msg.sender) revert NotYourDream();
        dream.parentDreamId = parentDreamId == 0 ? dreamId : parentDreamId;
        emit DreamChained(dreamId, parentDreamId);
    }

    function mintDreamCard(uint256 dreamId) external returns (uint256 tokenId) {
        Dream storage dream = dreams[dreamId];
        if (dream.dreamer != msg.sender) revert NotYourDream();
        if (!dream.interpreted) revert NotInterpreted();
        if (dream.minted) revert AlreadyMinted();
        tokenId = nextTokenId++;
        dream.minted = true;
        _safeMint(msg.sender, tokenId);
        emit DreamMinted(dreamId, tokenId, msg.sender);
    }

    function getDream(uint256 dreamId) external view returns (Dream memory) { return dreams[dreamId]; }
    function getDreamsByAddress(address dreamer) external view returns (uint256[] memory) { return dreamerDreams[dreamer]; }
    function getTotalDreams() external view returns (uint256) { return nextDreamId; }
    function tokenURI(uint256 tokenId) public pure override returns (string memory) { return string(abi.encodePacked("ipfs://dreamlog/", _uint2str(tokenId))); }

    function _uint2str(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        uint256 temp = value; uint256 digits;
        while (temp != 0) { digits++; temp /= 10; }
        bytes memory buffer = new bytes(digits);
        while (value != 0) { digits -= 1; buffer[digits] = bytes1(uint8(48 + uint256(value % 10))); value /= 10; }
        return string(buffer);
    }

    function _contains(string memory haystack, string memory needle) internal pure returns (bool) {
        return bytes(haystack).length > 0 && bytes(needle).length > 0 && _indexOf(haystack, needle) != -1;
    }
    function _indexOf(string memory haystack, string memory needle) internal pure returns (int256) {
        bytes memory h = bytes(haystack); bytes memory n = bytes(needle);
        if (n.length > h.length) return -1; if (n.length == 0) return 0;
        for (uint256 i = 0; i <= h.length - n.length; i++) {
            bool found = true;
            for (uint256 j = 0; j < n.length; j++) { if (h[i + j] != n[j]) { found = false; break; } }
            if (found) return int256(i);
        }
        return -1;
    }
    function _extractJsonString(string memory json, string memory key) internal pure returns (string memory) {
        bytes memory jb = bytes(json); bytes memory search = bytes(abi.encodePacked('"', key, '":"'));
        int256 startIdx = _indexOf(json, string(search));
        if (startIdx == -1) return "Unknown";
        uint256 start = uint256(startIdx) + search.length; uint256 end = start;
        for (uint256 i = start; i < jb.length; i++) { if (jb[i] == '"') { if (i == 0 || jb[i - 1] != '\\') { end = i; break; } } }
        if (end <= start) return "Unknown";
        bytes memory result = new bytes(end - start); for (uint256 i = start; i < end; i++) { result[i - start] = jb[i]; }
        return string(result);
    }

    function withdrawFees() external onlyOwner {
        (bool success, ) = RITUAL_WALLET.call(abi.encodeWithSignature("withdraw(uint256)", type(uint256).max));
        require(success, "Withdraw failed");
    }
    function depositForFees() external payable {
        (bool success, ) = RITUAL_WALLET.call{value: msg.value}(abi.encodeWithSignature("deposit(uint256)", 5000));
        require(success, "Deposit failed");
    }
    receive() external payable {}
}
