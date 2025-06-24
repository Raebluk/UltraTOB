# UltraTOB

## Config List

所有服务器相关配置参数。

注：除 `value` 和 `mission` 之外都可以配置多个值。如 `channel` 和 `role` 均可在一个条目下配置多个值，例子可以参见 `playerQualifiedRequired`。

### `expDoubleLimit`

用以配置开始给予每日双倍经验上限的经验值要求。

- 类型：value
- 默认值：4825 （该数值为20级所需要的经验值）

### `playerQualifiedRequired`

用以配置进入社区后开始参与经验任务系统所要求的 Discord Role，如 `@已读规则, @已读指南`

- 类型：role

### `userCommandAllowed`

用以配置允许使用 `/user` 指令的频道

- 类型：channel

### `modLogChannel`

用以配置手动编辑经验，金币等数值系统的记录广播频道。

- 类型：channel

### `missionBroadcastChannel`

用以配置任务接取，完成，和被拒绝的记录广播频道。

- 类型：channel

### `missionDivRole`

用以配置 `任务部` 职责ID，持有对应职责的成员可以使用任务部管理的各种指令和功能。

- 类型：role

## Command List

## Admin Command

下列指令通常都需要 `Administrator` 权限或额外的服务器配置才可使用，并非面向一般社群成员使用。

### `/config`

该指令组包含一系列相关指令，由 `Subcommand Group` 实现。没有单独的 `/config` 指令可用。

### `/config show`

显示当前服务器的全部配置列表。由一个社区Bot设定参数一览 Embed 展示。

### `/config add`

为当前服务器添加对应配置。

实例:

`/config add name: userCommandAllowed value: 1348487926689829011 type: channel`

对名为 `userCommandAllowed` 的条目添加类型为 `channel` 的值 `1348487926689829011`。

注释：
- `name` 配置的条目名称。
- `value` 配置值。
- `type` 可以为 `value`，`channel` 或者 `role`

### `/config del`

为当前服务器删除对应配置。

注释：
- `name` 配置的条目名称。
- `value` 配置值。
- `type` 可以为 `value`，`channel` 或者 `role`

实例:

`/config del name: userCommandAllowed value: 1348487926689829011 type: channel`

对名为 `userCommandAllowed` 的条目删除类型为 `channel` 的值 `1348487926689829011`。
注意，如果该条目内没有对应的值 `1348487926689829011` 则指令失败。

### `/config mission`

为当前服务器添加任务频道监控。该指令服务于自动任务审核系统，为成员参与服务器任务流程“减负”。

注释：
- `quest_id` 配置的条目名称。
- `emoji_id` 可配置为 Discord 自带 Emoji，如 `🎉`。若配置为服务器自定义 Emoji，则需输入对应 Emoji 的名字，如 `warning`
- `channel_id` 配置值。
- `reward` 奖励数值。
- `reward_type` 奖励类型，可为 `exp` 或者 `silver`

实例：

`/config mission quest_id: Qjdyrltd065 emoji_id: 🎉 channel_id: 1355579246919028999 reward: 50 reward_type: silver`

监控频道ID 为 `1355579246919028999` 的频道内的消息，如果有管理或任务部成员对一条信息用 emoji 🎉 标记的话，则判定该消息发送人完成了 ID 为 `Qjdyrltd065` 的任务，获得奖励 `silver`，数值为 `50`。

### `/quest`

该指令组包含一系列相关指令，由 `Subcommand Group` 实现。没有单独的 `/quest` 指令可用。

### `/quest publish`

要求 `Administrator` 权限。

发布供社区成员接取的任务。

### `/quest review`

要求 `Administrator` 权限。

检查目前已提交完成检查的任务列表。

为每个提交的任务提供 `Approve` 或者 `Reject` 选项。

如果提交的任务被批准完成，则会自动发放任务奖励到提交人，发送任务完成通知到提交人 DM 以及 `missionBroadcastChannel` 配置的频道中。

### `/vmod`

用以编辑社群成员的数值相关的资料，包括`经验（exp）`和`金币（silver）`。

命令的格式为 `/vmod dctag: type: amount: note:`

注释：
- `dctag` 编辑目标成员的 Discord Tag， 如 `neilyao_`
- `type` 允许值包括 `exp` 或者 `silver`
- `amount` 具体数值，正负值皆可，分别对应增加或减少数值。
- `note` 数值编辑的原因，供查询用。

实例：

`/vmod dctag: neilyao_ type: exp amount: 300 note: 测试`

给 `neilyao_` 增加 `300` `exp` 值，备注 `测试`

### `/gmod`

用以**群体**编辑社群成员的数值相关的资料，包括`经验（exp）`和`金币（silver）`。

命令的格式为 `/gmod dctags: type: amount: note:`

注释：
- `dctags` 编辑目标成员列表的 Discord Tag， 多个用户可用逗号分隔，如 `neilyao, raebluk`
- `type` 允许值包括 `exp` 或者 `silver`
- `amount` 具体数值，正负值皆可，分别对应增加或减少数值。
- `note` 数值编辑的原因，供查询用。

实例：

`/gmod dctags: neilyao_, raebluk  type: exp amount: 300 note: 测试`

给 `neilyao_` 和 `raebluk` 增加 `300` `exp` 值，备注 `测试`

### `/tmod`

用以编辑拥有对应 Discord Role （或称 Tag）社群成员的数值相关的资料，包括`经验（exp）`和`金币（silver）`。

命令的格式为 `/tmod roleid: type: amount: note:`

注释：
- `dctag` 编辑目标成员的 Discord Tag， 如 `neilyao_`
- `type` 允许值包括 `exp` 或者 `silver`
- `amount` 具体数值，正负值皆可，分别对应增加或减少数值。
- `note` 数值编辑的原因，供查询用。

实例：

`/tmod roleid: 1207185291266363412 type: exp amount: 300 note: 测试`

给全部拥有 `1207185291266363412` 对应 Discord Tag的成员 增加 `300` `exp` 值，备注 `测试`

## General Command

### `/user`

显示自己的用户资料卡片，包括
- 等级
- 会阶
- 每日文字经验上限
- 每日语音经验上限

20级和以上用户额外显示
- 金币余额

### `/quest`

该指令组包含一系列相关指令，由 `Subcommand Group` 实现。没有单独的 `/quest` 指令可用。

### `/quest list`

查看当前可接取任务的列表，并提供接取任务的选项。

如果有已接取任务则不会有实质影响。

### `/quest info`

查看当前接取的任务，包括
- 任务名称
- 任务截止时间
- 任务介绍
- 任务奖励
- 任务发布人

### `/quest drop`

放弃当前已接取的任务。

如果没有已接取任务则不会有实质影响。

### `/quest complete`

提交当前接取的任务。

如果没有已接取任务则不会有实质影响。
