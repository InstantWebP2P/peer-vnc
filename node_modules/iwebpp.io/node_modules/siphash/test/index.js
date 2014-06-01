
var siphash = require('../lib/siphash'),
    assert = require('assert'),
    vector, key, message, expected, found,
    vectors = [
  ["aON1dHrq90SbG8Hx",
   "v7LyiwuCrB7EgAibPve6Yg2gLmggxE6j7ocR37EudrH_P9XX2rQK",
   "2acb62473f324993"],

  ["YOT4AG5F7ONRW5na",
   "4Ks1pPO_2wGYR-gfJShqUO-FirA9c5cF4oKwvStp2Ix5hHUg2klPofVJ8TZoBdFfgTh8",
   "99a0a3b91b811b8a"],

  ["63UlqXfSckA3Dv8S",
   "bMQudI8yVdDx5ScGQCMQy4K_QXYCq1w1eC",
   "f4711dbaa72c4e06"],

  ["P3hpmZEuwfDO_uZ-",
   "Wh8yRitk__n4MsETCTRFrB4bjWRtPjUZVLPnywlvv5nTMA2C71",
   "ea9ca3a62c97abf1"],

  ["d9oTrpd-a_Na4b6w",
   "f-NT",
   "cb77394158cb93b6"],

  ["fe88HBnyyEiuIJ8G",
   "KSWP9sFkhSdGsha0Fmd5raCf_eA5gnV1",
   "e5f132100a030ada"],

  ["o6LxtnACG0RGQ3z-",
   "k8zMl",
   "37b18ed691139e10"],

  ["AHGkoQQ6xdf90MD9",
   "HC9bz8XUYkan0jxYSaj0vP-cs324Y4PrnAXutwKBgIko5oOOOViJSjLD2m8WenV8HdF78J",
   "a3bb15a5eeffba9d"],

  ["TlVmpfbZMFkeuENo",
   "5is",
   "1e4f6a653a7224a6"],

  ["iBLscVfsPM1xrSFJ",
   "J-aH-",
   "1a48f7be9e405b0e"],

  ["hUehErdKolgd0erH",
   "DhS94w_07-vaAXo_msv8Fk57slIHnuxy3iv4Yymh5k",
   "445df39e18c0cf2d"],

  ["B-aq-09jmO0z_PUD",
   "1p2IMG4A1NMyWsfUS02VK8fOEhn",
   "b1832c5b5041e0a1"],

  ["fyNYE8SMJvYrDgao",
   "HWCtQs19BHZcH",
   "ad17e27c0efe727a"],

  ["5vQHK_yJlJez45N5",
   "8YJwfpxwbH9h-N27i-uTUUK2Vt",
   "c70811104d57d88e"],

  ["q7Oo0g9DDjLJ_pyV",
   "jQFAHtrTUDaCaSIcis5h2j4fyOJpJGfdZBMTO5GOAAB4AwZtutDenNZ",
   "8d0ee7e919b66fe6"],

  ["IUle6P8g2uyX_8ms",
   "hOKGFGrsAux60CQmbOjQd-EzQBKUjLbDUhhtsKt3ZY4",
   "980491d3ec66f740"],

  ["-bZa23onpInwqNWG",
   "DNbtZuulH9",
   "7f3c64d0ac8e02f7"],

  ["1xjmLXTmVJwse8M-",
   "j1_Hh",
   "7e53ad39b80651c5"],

  ["Ey7hygEVd8RxZdtX",
   "GNRDNJDu00L",
   "bfbc1b9204b8c489"],

  ["weTzikz4EGUbhSgC",
   "g1SXT7b4Zz6q2tQykV1tZS",
   "f060d2c6dc452769"],

  ["OjSaplYVoQPDXG7S",
   "QCk4v3D9s6R471p0xa--Vv00vzIaMpJ1S48Qnz6uzhmtke99HmWcY9vapyjdWVS",
   "7aeff75fc28ed0b7"],

  ["4g2ZB-SA-HlqJT7D",
   "N5Ht5QIk6KziyTE4-q5eNkqGdQgg8fxkr4w-ARqRgdaZd3XpbePGGb4jPFo3",
   "7fd4949bf898f57f"],

  ["CXOF2EKm5CDPYpNC",
   "xkY0T8bPF4JFq6Mu0K5YtFp7KfOni",
   "e2eaecc64218ac7c"],

  ["ID4UzFBiztXW--b0",
   "qyICNMPaivgDmX",
   "7abc58ba129c5f2e"],

  ["TaGesMDe_0UNGzcp",
   "nlNv",
   "1100685746d3f567"],

  ["lMDS8Vcs-8aCV9hJ",
   "KW44Qk",
   "3ece65c432822f45"],

  ["BmQCaB-c777zvFsc",
   "o-tr2zQVbtrmkH4rCCAXoXFt8KwAWo4YFpK",
   "d5bee9715eeba87b"],

  ["OQlCpJOLmsouyme1",
   "aRk9nyHhXlad-TpIemD2VTRiHVlzSysY7uKof9ApR5DejFjT-Bmdzl_z",
   "d7f96332eedec959"],

  ["t6Wl3FKDhr9FAMzz",
   "BLu17bk_iQtpGv1N4A",
   "8c99547381790750"],

  ["XU5km7La0ujNVvlV",
   "OUEAH4yu6SXQ4I8zjn07NuB_AudmoewXc39HqgN8rc",
   "6c48b0d28e64b4dc"],

  ["zDKBNpM2cdf0HwkK",
   "dEqgpqTRc",
   "511b93c5f2392add"],

  ["yZGrKEShM0z7Vvns",
   "sgUtgxRQpMl_o6iuZqomKhJxaSBCD_NBHa2lqX3cWfq8byu",
   "41a8df813b72b3d3"],

  ["4-wM8GXg1a7hyerE",
   "djJ3-b2",
   "7372ef6d77fea59d"],

  ["jD3Y4PgdExHU2JaY",
   "uQC59dKTf3unOGu-Lg9IgmC8MTSg-BcH-",
   "ff28e876b5aeb3f9"],

  ["dZhRW8ubIZovieQg",
   "GCbxph1HICSKgHLafk_8TRjGdZa7jnJOu",
   "df2b56c9e24c1849"],

  ["P9hudzT3H87QzC9E",
   "Vfeo26fUa3sLk6BNM",
   "6b7fd6e0dfae961f"],

  ["ocfdt04Np8Bs5hn9",
   "dQiaUqksbXOWmBPt2kBn0ARiVkr3r4mBwypQq",
   "d4515c94069bfdcb"],

  ["UuQ68x330IdojsLI",
   "pb6-OdmVdQ1gLP8E1szvlf0T6aOQp-EQHPW-tAKQ8Xj",
   "e511fbd81a0b9e17"],

  ["T4ec6Q68QKiuIARL",
   "BeLjFIoODtDg5vLMLBN1Sae",
   "7442e550412b67fa"],

  ["xmZBUpwjJwnXZAp6",
   "WS2F3Nzg2s7TqVIygm8W1tQyNc6DFy",
   "138a8bb6fab1ceba"],

  ["4qB6m0d_ryzb3w6q",
   "2Nr1sd1phWDB9gnuYOLUsjvX9jxntScWyRlX3Nj_xs8MV10LGgSgfRBKVGnO",
   "fd8ecd374fcf6561"],

  ["SmVONU3BEODnkbdM",
   "G4WIU3UrBqbN6_nccFrIyx_TdXx-W80YzWw",
   "6b02a94914869321"],

  ["zseM9_-0y7B9URxM",
   "us8B1DmHxOF10ue3jm2VfoJ250h364zRd2U8VIm2Lbkf3OWprSUpLF4ePjdj5aS",
   "a64eaf8b97622f50"],

  ["WY_sEWLFAybHSwX4",
   "vLJyXNkHCYGHWsvhXcU2sWYzgFYlWF7A_ZjFg8kJ4wwuJ",
   "eba90a5acca84384"],

  ["maWrEov1bBjSq2Zn",
   "sCP9zPakZ_wZ8hcQu-G6nN",
   "c91fc642dd6bcc88"],

  ["tXInZHO-x4AWxKTp",
   "JQUM_O-E4-YI6dhxo",
   "60c0de1fb7a6f524"],

  ["OqaQt_b1hvU-atC3",
   "X7Ou8cKo17xHlq_5gwM56GZrCSJBReeA60pDj2hUer6",
   "5d9918744faf6ba9"],

  ["nHdnXHGmGknC8FfC",
   "cRupnAESNmU",
   "d508200751cdc812"],

  ["59n9lAJdrxIz3joe",
   "WBPr",
   "ffa5e9f27a98994b"],

  ["q-PAAgkE9z2xed85",
   "AFOQD_H7MO3q3cxLa7TOUd89kpH03SpjpqmzY6AX16-uZFYcZZBb8D",
   "042a63ae8565042d"],

  ["tBzStZxn2ZqlQfBf",
   "nZdIaI7-bdqqh6aU7w4HfDCByX-x4_3q9Jf",
   "904bfd32e0c731fd"],

  ["rH8Nn75LyYC0hjVG",
   "IrDPpL-dkoh6VTy7pOtKKdAD9dLwUnE-",
   "054a4abe7f61024c"],

  ["F-pI7AhpS1V-48eT",
   "Ao7hV41P08Zq4C1szyOVN7K1iWW8z",
   "72ae69a20d554c79"],

  ["Khje_RmXXmJ3CAb1",
   "TvMx3ISTfIQ",
   "b21b2df2b65c66ed"],

  ["G1KRzk-KMqCk-kbD",
   "imHZWdBz01lGR3m1zuO74berNn68uFZR3kcoWEaMhVjJ1g",
   "b8cb65c77e2203a5"],

  ["wJhnTtBLcy_1rZay",
   "qbZ6oK0a4eWf2ud1sEnKLeguOmYsbG4aOTdlMdrf",
   "845a58b4930ea9e2"],

  ["vVl9fhjkwASu2WXe",
   "8-CjQylw18IKWgAL2mMxo",
   "2a48ac4a22cac11e"],

  ["m2Qx2Dtbvwv3qjNJ",
   "WrIqIIsHqbgm3Qfg03QvaVG9G6fz2zxjnfNZUVuX8XUtjz4LQuj3VZNh",
   "6a75eabb3a40a3ed"],

  ["5R1maUgHiPQ0ZoaD",
   "SZJ6uMXnMuLll2xOfHcy_DE",
   "3705b41383b61ad1"],

  ["dDBufcmObAK1dKYw",
   "ayjd0F5mqWsVF0MtUNJYo8S8GhuCsMCnEU6k3H9z0f8",
   "3f270438f5cef47e"],

  ["o_YPVOjQ7Xw0G9OD",
   "UPF-HW1hJukwdVvhCl7IZJzy7a",
   "213bbd58d630d31e"],

  ["oule-vFYlFJfsXU3",
   "8ORL7DUv28-yVfUw_cJ3imWP-iXrQRmzZRp0jtspwW_qm-rXmc1aBsbvbAut8",
   "71e6179957f33e42"],

  ["kEPlQxhC27GQcJeb",
   "wL-dAWvwZapITZZvgW46",
   "d8301721fc345399"],

  ["GFilE6NpBPWE25uB",
   "RzoQCcd5NVeDbd2cx",
   "d857f48e68dd6590"],

  ["sENqlFHs0NvkY28u",
   "Gm2ojB-BJBdL",
   "34d70e5e072ae24b"],

  ["mxiOr15qouOEhzHS",
   "SChjLg6SXpEb9",
   "e5159ed34f3840ae"],

  ["pFL_Sbx5RW0fuPHO",
   "hdb8HqaxEN99N4V1STTpnR4kr9F-lONwKp2TcOCopBFnDrjITz3jHPM4WKIYyw59US",
   "c94e8e6fa5e4426c"],

  ["sMgAXpCtVqeFm14R",
   "dNPnh6shnGYEZuN0id",
   "ff54217e14659365"],

  ["nTu9mRGqYc1SOPk7",
   "ogL8VEqgoMkh6YNgTzvF4f87wHvmRhzncGPunN2ZJ5p3qUqZeJ3",
   "521ccf22901710fd"],

  ["d5jDH8Ppk82zj_vd",
   "5sfq9Q_0P0H",
   "4df01af75904f5c5"],

  ["bEEUPVwdHlYwYL6o",
   "AGoiVTE9foWm2MZqsn3dfS1XQiQW0QJwLXi6oXR2L9nMnPCPG_oF",
   "f214b10457d9cbba"],

  ["JbKhWuTfRMWb4hFD",
   "NTNhYIahQ769TsCDwFyfOYZ8x6np58jg9hMAHFH-BMv7hBwESi596D4aDuyPabFGbqcG",
   "3bdfd59261a64f3c"],

  ["hvCtw1q_GJUBFW_X",
   "uL5zgFM9WUTyO25dzVCmSVOxbpV70ZPurKK-CPUAmP",
   "3d7bb70769e9047f"],

  ["hWxh0P6EXlm4yYKA",
   "NUgrOoTOfqaB6JDZj",
   "b7bdb27595f9ff60"],

  ["TLHDMak8qeH3ABaV",
   "HW-7PPunyMCinXt8QjQUuJUzZZQs1-T9ADR-6y",
   "4a83f022d855a72e"],

  ["uE4OfzzqHVDH8lbd",
   "8KCUyGtkcG-T8gA3lpplC13LsnFZ",
   "4cf3842f60210912"],

  ["ocjA0Quge9vdCDbH",
   "tLlU03I9CDBbP1Pnl6KM3MW34TNzuuZYv0u-uU-l7RtFF0OmGoySyg_yc7vWswGkz",
   "0be85bc57ee3ae7c"],

  ["TDVmxGeyDULfxyrz",
   "A57Y0_L6K4TTzQx1-Yr1E6fVAZi31RyipeK0Q4uqwXXfRLo4tz2a5PSqN3-bdQ4f2",
   "fb32550ce389d435"],

  ["8OhqW3sA7s1vqEDr",
   "jlFquRWvL07TyLjW9ZNk81gxkvs4u1WLkNhOQVLOjFjw3iecMjun5Yk0xcruo",
   "22731deb43868293"],

  ["9kPcY6rfhPzSzEGn",
   "nS1kAxpsghzJJXiCzhNycDk2_EJ_yIT97fV2kxXTtfZ9p0",
   "59d14fb8edb06db2"],

  ["AJJ_yoEL8WyEtA1U",
   "vFNErhfCk1TZiTFMA6J8D",
   "66a7321ef78e3f1a"],

  ["PBr4drRAJTaWv5Um",
   "5quc8Vd2rHVNk2NoDxk3TL",
   "022a4a6599d17196"],

  ["MnODoRJI2FgZrvLs",
   "gqJ_7HnrfiqYkenyvhe53SB1vTBgMiMB3kxF5",
   "a13c27829dd80bcd"],

  ["iSxQPJpp_s0ws-4b",
   "K-J",
   "b55b5a70f1d14e2e"],

  ["ZMm2tCGDJ04A3I_6",
   "gw-wcFYO1G2KEqJagWAic2l2d1FoTVXVT",
   "1624924cd8a63c16"],

  ["Hxf6qsSIV6blPdB1",
   "GTWOerCQdUMkL6it6hEEPKBcOe_9f_B618ivjeM3BKfjzRQ8rvcGjUUJnsljerca6",
   "5b04ad4f24644a7a"],

  ["U5gXdMrRYUdxuDjK",
   "siy9CxY2BbhazTqBWwFrtBLh",
   "331bd7bde7f85c4f"],

  ["YJiK_B-TENJsVnd_",
   "Ohyz8XU06XWewcgTX-PffLVdatU3UFl6CYe",
   "df46b8bced5b9316"],

  ["J7wVNfLdkCCtndH5",
   "1Vw163YqXwP8cPXIy5dSkcIoClBep7gWb0qGJzHM8h_hzk2GFtZyLKk",
   "4a67904b91dcdd7b"],

  ["elId3b7ZyOg6HVif",
   "N89kQR7VMUgF4DyWhpTo_ZW2lERbNqFa1RdXjaUctO1FdevDAZaA",
   "7022c1f03911f427"],

  ["ydBueYO29jaUsEVU",
   "HMcnfvYjjz8Uf8bUhxXlAYHcyO7x5NHE_gc3bcWSMWJD2JdryrUBBdYj1",
   "22827e8ff4200ffc"],

  ["fVprx-PzTSx6CUcX",
   "Q",
   "01db373e87f016fd"],

  ["9ORMwecQjlob9aTT",
   "2cpq2XTWPk5sVLlN4OR5y6X_rTRFNUURgrwnWDg76u927cYud6PS-17UTgd3TO9g3K4",
   "fa55fe38886c7c0f"],

  ["-V3BEGXuTWtFOMv4",
   "8l6qcZXfG9iSywi1IgwJ_PkZh0Bg2iR1cbGps_sWPdKXbIvDDX-3IeTTg",
   "e83848066312086f"],

  ["Cbvx4_KdboiNHs6P",
   "nzUo0UnqKn05adw5g0jtBN703bUgb8UxywfC93I7KN",
   "2dce194d9d5f1155"],

  ["SDPzfgeqkvmi62JH",
   "Z6kJuDD-8FSz1VwOuPeoSJ6X-4hpib563UjYxtFcB4SvhQr-Hstg5OhMi4iZZ",
   "615fb48d3aac2399"],

  ["mBJlhP6D3M2raEjD",
   "ogtg66jr2KLCFO2RvodOXw0mt4XS6BOnLhBI_gDV0",
   "96e66cf061c6e755"],

  ["Sz-mxKc7KGM7SDaf",
   "ecQ-7-3VddOdMSeKUbZE1t6Aa67pYGXjQeOckq1l50GkvfomFr",
   "b2da4a8e8518f112"],

  ["_5ck5scojT4oyJEq",
   "43oLkeixGHShTMUhtI",
   "220ba502216bbe23"],

  ["48ulC82W4qv49InN",
   "8HQyT55TtmGahy6w",
   "b96465a47c1c4602"],

  ["-exgd5coAHqBu3ga",
   "vRfqYthbUNh",
   "8f84728a608dbc30"],

  ["hJEBugObOX06pplH",
   "oYYZ-v",
   "fed18a2e05597099"],

  ["eSDsC63oTtVfi_F7",
   "BVmyPas409CmRHiRRiTPjJL87KgJefuDK6lEh5isghLl7l3a4Xmxa",
   "52a524adfb1ec615"],

  ["KZtUPWMUr469RWL8",
   "F9K6TUd6j7Dm25rAS7cqOKDtSnnxj0hYKVTMFQ6CfA5218gPeZo",
   "ad3c363927b7e9cb"],

  ["0TeBxGk-V7RPSZML",
   "kmL1fKqHwAoxI1b_ap8I9fGZMmcx3gIMiglxLLPFWOoDNUGe",
   "87a6e747940d07c1"],

  ["PWYY82PNqwshPHiv",
   "Ya4LyHqxIxK8GaND9FIzqugleh-QELha_ntbRJixl6hZI5m3RfdrcntjiPJ",
   "6c84a5813740b11b"],

  ["PtCub86vGwNj1tcv",
   "qR08eqAeNrrUYDl18C-wttqMDk",
   "7d07032664f78642"],

  ["3eqQxzhNdv2kJqy5",
   "0wxAd9NT-Z8xFzomFwgMqMVbaUg",
   "0d9b9fd369a5bf24"],

  ["MgEjpTNPFFwes6Sm",
   "7SCVGNJYZhtnbiLZAE5TrsL5K1X",
   "c7e3033031c94fd0"],

  ["vSofRAYxXUU1qjhl",
   "HATE-YsASxySRkK5aJR4yV0mxx1YAuEgM5tUqyJDc7cLL",
   "4a07874418b7cd3d"],

  ["kIUe96sZ6LV464T_",
   "rjwrCOQAzLFbIM_3M7KfDQ1A6r3nkebk-dgqORG0Uy-n89_apYNLVTbdr3yuzXKOTfkRh",
   "bae1da917e8fd653"],

  ["8wao85IcCu1mC-Rc",
   "AdVncBX6wkLXqMQPol3tNDPd5HJ",
   "3fd74bdb24f3dfa1"],

  ["NRVNeO5wysG3DRuU",
   "Mr8vhiVPo5GpI6sho4R09k8D-vFgcghF3-kF",
   "b4b6bdfee13977f6"],

  ["VHJZOECxfyxVyufk",
   "TMB3UMDEIs-vj_9aDBNDzT6HkHcwQQhr4EnG6A1AD9JkHENVAAQnS7s",
   "3e7b1b3874455575"],

  ["TUfnTd3pmaJzSdD4",
   "VoRGCJgaGEhPSGRl0EPKWIzN7CRpD49CiyjC7y_4xRpppMNlR4v",
   "ba4ed071048c7403"],

  ["-I1YgwmWxehyB6kv",
   "IplQLxea3JGywQn3XMNWrqVbE",
   "6184650bc96dfb89"],

  ["4ic5nM5lbfMOXDRR",
   "TfVtpOoAQt1IxL0qJtAQoCJJThyxncIagOvKSpxjD7RDmh7YQBHWPkuv5lpSzpN",
   "2c7ab8556354cbc0"],

  ["NYOq6hIu2C-aZPhE",
   "QQa0EWIHXqbrkq3nBeXt6yEj12z",
   "3a64355215c5c728"],

  ["nC93tajnfzk6bMtM",
   "p9gbEB4nMHXDqmOC413rI4Z",
   "20dbaa598f668cc8"],

  ["ZCCkYIbGOzXa5GRO",
   "2f9VGQeb4AtW6SwPjAGxxjyHNw3-MZj2BfxttNLxM0Tv_rpXO8TUH4YASb",
   "0c512395c264ae00"],

  ["oapO2W6hces4Pfkc",
   "oEyf5eqpM-N7LBp3C5vejvO7M87OzT4MHdwJz",
   "f0683ccf14c7c38c"],

  ["__daPiDXrnPpS7eO",
   "1_tnhApr6nZbWIEPja0jAJ6LbTvD6oAEvPyrLYQ",
   "d6927c7c774cf4ff"],

  ["5iIExqPt5W-ZpudD",
   "jNbLiDmQdN5X7HEOfgnAi5A7s1pGXwP41hX1Z",
   "1f4296aecb7d4495"],

  ["gD_J-R8tOb977BtL",
   "f7A81Qbh8gQhfRpOmtz5-ZJqBxiQJ6myBhGfqK7BVaGBL_W2MvfB",
   "6ee8be8dc48c266a"],

  ["ZxHO4JJ8p45jTUXU",
   "fs4Oy8mPZS6919SZ7gDyKIILDkXnPt8SsXkfBd-Mnm4wO6alw-veQD9",
   "86548866646835d1"],

  ["2bVzT0moojGNQgIX",
   "nuyb-AgYY-rsmhtdav3LC7meSPy1dCosjSw0YAvgP",
   "fc94936819f7c901"],

  ["FicyyNT0BRua05i9",
   "TG4leSS_mcrZ_L68GKFdxc4-McFCCtdG7QpbPu_MolD5luE6n3dKlPzb9MvfvkiZKi",
   "ee72ebb2e0429688"],

  ["g5Qaf7mQAIxuHR0O",
   "A6u5gtb1yMSiGlWVt3exYsRS",
   "c115472b207314a9"],

  ["aOACI6GP6u4WFyxp",
   "1eEx55L3E9MZga7l1WzpnKfI",
   "c34565d91b0f1ab1"],

  ["Rr2jLg-asIQrlaRJ",
   "rgALEbs",
   "20452e045afa67a3"],

  ["p8qW0oYzj5zi55s5",
   "V1ZCoK73ifwcnzPjQEN7Q79MtZCskcpqiE3gfbqYPYRmy-q0lPxopkZZp2lNWKkpL_q5z",
   "7bee2633aef0791d"],

  ["wA0cNUJOhIMpiopE",
   "U2RE2L2zZysyOTcsj5_JosVDaMRtUxkRWVCeBH0AeodMvYGBcHizhxc2QM89",
   "2e03a807a494e628"],

  ["zBCN1w4ypWCEfpwC",
   "VRcTwONsyRQIy2ymVniMmry",
   "de78bd983638b1b8"],

  ["i8cumEDwOxSXT0gL",
   "ifKav",
   "abf629b3e4c1be35"],

  ["g3EswbaCSNMsegzm",
   "rTFnEuEDlwBB0Dw_q3-FUSaTCEjWe0pOPZDIWD35Us08Qa-nulc57YjDoGphUfBamq",
   "1130933cb377409d"],

  ["iYsckWoQTk5ap8YO",
   "wIyTqa43-_GiZlHJ8UXcD_tnqKikH5DZUWxdQ1xjYMyzCr2JvKKRBm8BbcDl_Q8p",
   "6a742d30b7aaed60"],

  ["Iyk5MoAjoWq4n8bG",
   "IV2N5MC6kvk95ykEzb3jj0A7Sv0jjif45SR1avc0bRWot2aW",
   "072fccf2e1951763"],

  ["NfzdRXCegRRsHHYj",
   "5uLBPbyFQqiv",
   "daabcc24c06e2d88"],

  ["YiJTXegVwaNDtlpl",
   "DbwKoF3CI5kd2JRKwfyuLpeGd6sFhqI0t43C2ph",
   "3c6b7209bf937ebc"],

  ["ZuUlFM-yEzZ9XHKj",
   "errecd71",
   "6f5ce3952f54e79e"],

  ["EtEXELa6V_NSjvEh",
   "yrTjrRuW8mJc3utw2JUH7iIW-J5vF3t9GC1-ZvRmO8UXNsG8-I3Iqgtinzoabqqbs1yvR",
   "47aef668d79034ba"],

  ["q2uA_VwMnaBtAgTx",
   "uJOymuDgBBS9Ec56JRGmKYsMHoGLCKA5wzwhtYf-g8-IT7UsAX1JHFGSV0EF",
   "ba6106d486bc41b0"],

  ["4RmqR10QiIZDDKNO",
   "oWY0Aj2CDCWuEFhdNHq2RFcGJD0sSRxK5K",
   "0d52287ae4ee1c72"],

  ["a9DfUPCLyQ_yrNIa",
   "5G-6AVe7CBJl-NuuUN_7TN",
   "6fe3cfc2b97cce5f"],

  ["8oB5yG87C2v5j0_4",
   "1S-aiUNRJ2c",
   "51d0245a4ff22a7b"],

  ["ZA2ZT22NXwD_UvTM",
   "UpV3pLYniWPm-PnWUAbBNeO4V-zuuw6IZQ1ZprLsC_LjGdSJP7rZCnoPz",
   "6dd48df68066d1bd"],

  ["ycz6aiuQFGKxZVsM",
   "fBuJp4_A_hiq--4uBhxjXfT3nRaYEJ8azW2_FKooXdSVRv2Y03VoWzPzG",
   "184b0a49c7a27ff1"],

  ["eAmt0pClMyL8Sk69",
   "JFzXjfJhEMUCYEDrBKRM9OFFK0PSX",
   "02c245103c2ba7b0"],

  ["CTFnU2nwy9s1_kBj",
   "hEHqR0idFTzbvG193aLYj6y2DFPi2UKQut_A--43PdN1XF",
   "79e6377df89c5406"],

  ["CAhom0f872WEDXP6",
   "dmX",
   "b1f40313acaf62cb"]
];

for (var i = 0, j = vectors.length; i < j; i++) {
    vector = vectors[i];
    key = vector[0], message = vector[1], expected = vector[2];
    found = siphash.hash_hex(siphash.string16_to_key(key), message);
    assert.equal(found, expected,
                 "Key: [" + key + "] Message: [" + message + "]" + " " +
                 "Found: [" + found + "] Expected: [" + expected + "]");

found = siphash.hash(siphash.string16_to_key(key), message);
var m =
((found.l >>> 0) & 0xff) + "," +
((found.l >>> 8) & 0xff) + "," +
((found.l >>> 16) & 0xff) + "," +
((found.l >>> 24) & 0xff) + "," +
((found.h >>> 0) & 0xff) + "," +
((found.h >>> 8) & 0xff) + "," +
((found.h >>> 16) & 0xff) + "," +
((found.h >>> 24) & 0xff);

console.log('{<<"' + key + '">>, <<"' + message + '">>, <<' + m + '>>},')
}

key = [ 0xdeadbeef, 0xcafebabe, 0x8badf00d, 0x1badb002 ];
message = "Short test message";
found = siphash.hash_hex(key, message);
expected = "f2e893485bd3bade";
assert.equal(found, expected);

key = [ 0xdeadbeef, 0xcafebabe, 0x8badf00d, 0x1badb002 ];
message = "Short test message";
found = siphash.hash(key, message);
expected = { h: 4075328328, l: 1540602590 };
assert.equal(found.h, expected.h);
assert.equal(found.l, expected.l);

key = siphash.string16_to_key("0123456789ABCDEF");
message = "Short test message";
found = siphash.hash_uint(key, message);
assert.equal(found, 3323740134809132);
