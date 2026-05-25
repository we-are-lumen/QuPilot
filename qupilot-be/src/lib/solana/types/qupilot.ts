/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/qupilot.json`.
 */
export type Qupilot = {
  "address": "2auiCCwYy8pj6LpDnMomZRqKs49Gb5oRjtVkYDYRVmm3",
  "metadata": {
    "name": "qupilot",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "QuPilot reward pool escrow program"
  },
  "instructions": [
    {
      "name": "claimReward",
      "discriminator": [
        149,
        95,
        181,
        242,
        94,
        90,
        158,
        162
      ],
      "accounts": [
        {
          "name": "claimer",
          "writable": true,
          "signer": true
        },
        {
          "name": "questPool",
          "writable": true,
          "relations": [
            "participation"
          ]
        },
        {
          "name": "participation",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  97,
                  114,
                  116,
                  105,
                  99,
                  105,
                  112,
                  97,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "questPool"
              },
              {
                "kind": "account",
                "path": "claimer"
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "createQuest",
      "discriminator": [
        112,
        49,
        32,
        224,
        255,
        173,
        5,
        7
      ],
      "accounts": [
        {
          "name": "provider",
          "writable": true,
          "signer": true
        },
        {
          "name": "questPool",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  113,
                  117,
                  101,
                  115,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "provider"
              },
              {
                "kind": "arg",
                "path": "questId"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "questId",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "verifier",
          "type": "pubkey"
        },
        {
          "name": "totalRewardPool",
          "type": "u64"
        },
        {
          "name": "rewardPerUser",
          "type": "u64"
        },
        {
          "name": "expiresAt",
          "type": "i64"
        }
      ]
    },
    {
      "name": "joinQuest",
      "discriminator": [
        179,
        5,
        14,
        3,
        119,
        119,
        118,
        89
      ],
      "accounts": [
        {
          "name": "verifier",
          "writable": true,
          "signer": true
        },
        {
          "name": "questPool",
          "writable": true
        },
        {
          "name": "participation",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  97,
                  114,
                  116,
                  105,
                  99,
                  105,
                  112,
                  97,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "questPool"
              },
              {
                "kind": "arg",
                "path": "userWallet"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "participationUuid",
          "type": {
            "array": [
              "u8",
              16
            ]
          }
        },
        {
          "name": "userWallet",
          "type": "pubkey"
        },
        {
          "name": "agentWallet",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "markParticipationComplete",
      "discriminator": [
        106,
        221,
        4,
        87,
        115,
        149,
        251,
        12
      ],
      "accounts": [
        {
          "name": "verifier",
          "signer": true
        },
        {
          "name": "questPool",
          "writable": true,
          "relations": [
            "participation"
          ]
        },
        {
          "name": "participation",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  97,
                  114,
                  116,
                  105,
                  99,
                  105,
                  112,
                  97,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "questPool"
              },
              {
                "kind": "account",
                "path": "participation.user_wallet",
                "account": "participation"
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "markParticipationFailed",
      "discriminator": [
        52,
        89,
        219,
        124,
        140,
        112,
        166,
        47
      ],
      "accounts": [
        {
          "name": "verifier",
          "signer": true
        },
        {
          "name": "questPool",
          "writable": true,
          "relations": [
            "participation"
          ]
        },
        {
          "name": "participation",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  97,
                  114,
                  116,
                  105,
                  99,
                  105,
                  112,
                  97,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "questPool"
              },
              {
                "kind": "account",
                "path": "participation.user_wallet",
                "account": "participation"
              }
            ]
          }
        }
      ],
      "args": []
    }
  ],
  "accounts": [
    {
      "name": "participation",
      "discriminator": [
        237,
        154,
        142,
        46,
        143,
        63,
        189,
        18
      ]
    },
    {
      "name": "questPool",
      "discriminator": [
        239,
        68,
        16,
        31,
        48,
        177,
        249,
        255
      ]
    }
  ],
  "events": [
    {
      "name": "participationCompleted",
      "discriminator": [
        137,
        239,
        186,
        71,
        127,
        10,
        35,
        60
      ]
    },
    {
      "name": "participationFailed",
      "discriminator": [
        35,
        234,
        144,
        79,
        132,
        235,
        30,
        160
      ]
    },
    {
      "name": "questCreated",
      "discriminator": [
        179,
        90,
        201,
        178,
        90,
        69,
        73,
        67
      ]
    },
    {
      "name": "questJoined",
      "discriminator": [
        190,
        194,
        37,
        10,
        206,
        62,
        43,
        162
      ]
    },
    {
      "name": "rewardClaimed",
      "discriminator": [
        49,
        28,
        87,
        84,
        158,
        48,
        229,
        175
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "invalidTotalReward",
      "msg": "total_reward_pool must be greater than zero"
    },
    {
      "code": 6001,
      "name": "invalidRewardPerUser",
      "msg": "reward_per_user must be greater than zero"
    },
    {
      "code": 6002,
      "name": "rewardPoolTooSmall",
      "msg": "total_reward_pool must be >= reward_per_user"
    },
    {
      "code": 6003,
      "name": "expiresAtInPast",
      "msg": "expires_at must be in the future"
    },
    {
      "code": 6004,
      "name": "questNotActive",
      "msg": "quest pool is not active"
    },
    {
      "code": 6005,
      "name": "questExpired",
      "msg": "quest has expired"
    },
    {
      "code": 6006,
      "name": "rewardPoolExhausted",
      "msg": "reward pool capacity exhausted"
    },
    {
      "code": 6007,
      "name": "invalidParticipationStatus",
      "msg": "invalid participation status for this operation"
    },
    {
      "code": 6008,
      "name": "rewardAmountMismatch",
      "msg": "reward amount on participation doesn't match quest pool"
    },
    {
      "code": 6009,
      "name": "notClaimable",
      "msg": "participation is not in claimable state"
    },
    {
      "code": 6010,
      "name": "insufficientPoolLamports",
      "msg": "insufficient pool lamports after transfer"
    }
  ],
  "types": [
    {
      "name": "participation",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "version",
            "type": "u8"
          },
          {
            "name": "questPool",
            "type": "pubkey"
          },
          {
            "name": "userWallet",
            "type": "pubkey"
          },
          {
            "name": "agentWallet",
            "type": "pubkey"
          },
          {
            "name": "participationUuid",
            "type": {
              "array": [
                "u8",
                16
              ]
            }
          },
          {
            "name": "status",
            "type": "u8"
          },
          {
            "name": "rewardAmount",
            "type": "u64"
          },
          {
            "name": "joinedAt",
            "type": "i64"
          },
          {
            "name": "completedAt",
            "type": "i64"
          },
          {
            "name": "claimedAt",
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "participationCompleted",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "questPool",
            "type": "pubkey"
          },
          {
            "name": "participation",
            "type": "pubkey"
          },
          {
            "name": "userWallet",
            "type": "pubkey"
          },
          {
            "name": "rewardAmount",
            "type": "u64"
          },
          {
            "name": "completedAt",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "participationFailed",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "questPool",
            "type": "pubkey"
          },
          {
            "name": "participation",
            "type": "pubkey"
          },
          {
            "name": "userWallet",
            "type": "pubkey"
          },
          {
            "name": "failedAt",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "questCreated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "questPool",
            "type": "pubkey"
          },
          {
            "name": "provider",
            "type": "pubkey"
          },
          {
            "name": "verifier",
            "type": "pubkey"
          },
          {
            "name": "questId",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "totalRewardPool",
            "type": "u64"
          },
          {
            "name": "rewardPerUser",
            "type": "u64"
          },
          {
            "name": "expiresAt",
            "type": "i64"
          },
          {
            "name": "createdAt",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "questJoined",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "questPool",
            "type": "pubkey"
          },
          {
            "name": "participation",
            "type": "pubkey"
          },
          {
            "name": "userWallet",
            "type": "pubkey"
          },
          {
            "name": "agentWallet",
            "type": "pubkey"
          },
          {
            "name": "participationUuid",
            "type": {
              "array": [
                "u8",
                16
              ]
            }
          },
          {
            "name": "joinedAt",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "questPool",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "version",
            "type": "u8"
          },
          {
            "name": "provider",
            "type": "pubkey"
          },
          {
            "name": "verifier",
            "type": "pubkey"
          },
          {
            "name": "questId",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "totalRewardPool",
            "type": "u64"
          },
          {
            "name": "rewardPerUser",
            "type": "u64"
          },
          {
            "name": "allocatedAmount",
            "type": "u64"
          },
          {
            "name": "claimedAmount",
            "type": "u64"
          },
          {
            "name": "createdAt",
            "type": "i64"
          },
          {
            "name": "expiresAt",
            "type": "i64"
          },
          {
            "name": "status",
            "type": "u8"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "rewardClaimed",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "questPool",
            "type": "pubkey"
          },
          {
            "name": "participation",
            "type": "pubkey"
          },
          {
            "name": "userWallet",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "claimedAt",
            "type": "i64"
          }
        ]
      }
    }
  ]
};
