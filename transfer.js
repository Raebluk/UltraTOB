import fs from 'node:fs'

import { createClient } from '@supabase/supabase-js'
import csv from 'csv-parser'

// 初始化Supabase客户端
const supabaseUrl = 'https://uilsoskxvsrwdtaadizt.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVpbHNvc2t4dnNyd2R0YWFkaXp0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE2ODE3MjgsImV4cCI6MjA1NzI1NzcyOH0.1RjTqraM75a-_1L6c6tYnsPimEpZD9DR23fH_cDC6b8'
const supabase = createClient(supabaseUrl, supabaseKey)

// // CSV文件路径
// const csvFilePath = 'Player_rows.csv'

const ps = ['nayo5200', 'jabinshen', 'toby09000', 'shuang0729_69067', 'okelm1', 'ev1l_x', 'wuwuwuwuuu', 'ouhuang7274', 'syforever', 'galath666', 'guji_0522', 'empray7', 'shuwa1018', 'kilingsama', 'y331', '.kofishy', 'derek_h89757', 'nannbeii', 'weichenjian', '_ekuer', 'dijia8188', 'indigo_0124']
// search player database and update exp by +50 if player.dc_tag in ps
for (let i = 0; i < ps.length; i++) {
	const dcId = ps[i]
	const { data, error } = await supabase
		.from('player')
		.select('*')
		.eq('dc_tag', dcId)
	if (error) {
		console.error(dcId, ' | Error inserting data:', error)
	} else {
		console.log(data)

		// update the player exp
		exp = exp + 50
		// also create a log in value_change_log table
		// where player_id is data[0].id, player_dc_tag is data[0].dc_tag
		const updatedExp = data[0].exp + 50
		const { error: updateError } = await supabase
			.from('player')
			.update({ exp: updatedExp })
			.eq('dc_tag', dcId)

		if (updateError) {
			console.error(dcId, ' | Error updating exp:', updateError)
		} else {
			console.log(dcId, '| Exp updated successfully:', updatedExp)

		// create a log in value_change_log table
		const { error: logError } = await supabase
			.from('value_change_log')
			.insert([
				{
					player_id: data[0].id,
					player_dc_tag: data[0].dc_tag,
					type: 'exp',
					note: 'TOB语音经验丢失补偿',
					amount: 50,
					moderator_id: '1234730245685510145',
					created_at: new Date(),
					updated_at: new Date(),
				},
			])

		if (logError) {
			console.error(dcId, ' | Error creating log:', logError)
		} else {
			console.log(dcId, '| Log created successfully')
		}
	}
}

// // 读取CSV文件并插入数据到Supabase
// fs.createReadStream(csvFilePath)
// 	.pipe(csv())
// 	.on('data', async (row) => {
// 		const dcId = row.dcId
// 		const guildId = row.guildId
// 		const exp = row.exp
// 		const ct = 0
// 		console.log(`${dcId}-${guildId}`, exp)
// 		if (exp >= 6305) {
//       		// 构造主键
// 			const primaryKey = `${dcId}-${guildId}`

// 			// 检查数据库中是否已有这个primary key对应的player，并转换为json
// 			// const dataaaa = await supabase
// 			// 	.from('player')
// 			// 	.select('*')
// 			// 	.eq('id', primaryKey)
// 			// 	.single()

// 			// 插入或更新数据到Supabase
// 			const { data, error } = await supabase
// 				.from('daily_counter')
// 				.update([
// 					{
// 						chat_exp: 20,
// 						voice_exp: 180,
// 					},
// 				]).eq('player_id', primaryKey)

// 			if (error) {
// 				console.error(primaryKey, ' | Error inserting data:', error)
// 			} else {
// 				console.log(primaryKey, '| Data inserted successfully:', data)
// 			}
// 		}
// 	})
// 	.on('end', () => {
// 		console.log('CSV file successfully processed')
// 	})