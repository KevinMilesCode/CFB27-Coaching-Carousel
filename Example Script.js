const fs = require('fs');
const path = require('path');
const Franchise = require('madden-franchise').default || require('madden-franchise');
const { search, input, confirm } = require('@inquirer/prompts');

// Helper function to generate a clean, readable timestamp string
function getTimestamp() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
}

async function main() {
  console.clear();
  console.log('==================================================');
  console.log('       CFB 27 / MADDEN MULTI-COACH EDITOR         ');
  console.log('==================================================\n');

  // 1. Prompt for file path
  const filePath = await input({
    message: 'Enter the path to your Franchise file:',
    default: 'Week 14: Full Dynasty Path',
    validate: (val) => {
      const cleanPath = val.replace(/^["']|["']$/g, '');
      if (!fs.existsSync(cleanPath)) {
        return 'File not found! Please check the path and try again.';
      }
      return true;
    }
  });

  const cleanFilePath = filePath.replace(/^["']|["']$/g, '');

  // =========================================================================
  // 2. CREATE A AUTOMATIC BACKUP BEFORE READING/MODDING
  // =========================================================================
  try {
    const timestamp = getTimestamp();
    const backupPath = `${cleanFilePath}_backup_${timestamp}`;
    
    console.log(`\nCreating safety backup...`);
    fs.copyFileSync(cleanFilePath, backupPath);
    console.log(`Backup saved: "${path.basename(backupPath)}"`);
  } catch (err) {
    console.error('\n[ERROR] Failed to create backup file:', err.message);
    const proceedAnyway = await confirm({
      message: 'Do you want to proceed WITHOUT a backup?',
      default: false
    });
    if (!proceedAnyway) {
      console.log('Exiting for safety.');
      return;
    }
  }

  // 3. Load live save file into memory
  console.log('\nLoading live save file into memory...');
  const franchise = await Franchise.create(cleanFilePath);

  // 4. Dynamically locate and read the Coach table
  let coachTable = franchise.getTableByName('Coach');
  if (!coachTable) {
    coachTable = franchise.tables.find(t => t.name && t.name.toLowerCase().includes('coach'));
  }
  
  await coachTable.readRecords();
  console.log(`Loaded Table: "${coachTable.name}" (${coachTable.header.recordCapacity} total slots).\n`);

  let editCount = 0;
  let keepEditing = true;

  // =========================================================================
  // 5. THE EDITING LOOP
  // =========================================================================
  while (keepEditing) {
    const coachChoices = [];

    for (let i = 0; i < coachTable.header.recordCapacity; i++) {
      const record = coachTable.records[i];
      
      if (record.isEmpty || !record['FirstName'] || record['LastName'] === 'None') {
        continue;
      }

      const firstName = record['FirstName'];
      const lastName = record['LastName'];
      const currentSecurity = record['CurrentJobSecurityPercentage'];
      
      coachChoices.push({
        name: `${firstName} ${lastName} (Job Security: ${currentSecurity}%)`,
        value: i
      });
    }

    coachChoices.sort((a, b) => a.name.localeCompare(b.name));

    // A. Search and select a coach
    const selectedRecordIndex = await search({
      message: `[Edit #${editCount + 1}] Type to search coaches (press Enter to select):`,
      pageSize: 15,
      source: async (inputTerm) => {
        if (!inputTerm) return coachChoices.slice(0, 15);
        const searchTerm = inputTerm.toLowerCase().trim();
        return coachChoices.filter(choice => 
          choice.name.toLowerCase().includes(searchTerm)
        );
      }
    });

    const selectedRecord = coachTable.records[selectedRecordIndex];
    const coachName = `${selectedRecord['FirstName']} ${selectedRecord['LastName']}`;
    console.log(`\nSelected: **${coachName}** (Current Security: ${selectedRecord['CurrentJobSecurityPercentage']}%)`);

    // B. Prompt for the new value
    const newSecurityVal = await input({
      message: `Enter new CurrentJobSecurityPercentage for ${coachName} (0 - 100):`,
      default: selectedRecord['CurrentJobSecurityPercentage'].toString(),
      validate: (val) => {
        const num = parseInt(val, 10);
        return (!isNaN(num) && num >= 0 && num <= 100) ? true : 'Enter a valid number between 0 and 100.';
      }
    });

    // C. Apply change in memory
    const oldVal = selectedRecord['CurrentJobSecurityPercentage'];
    const newVal = parseInt(newSecurityVal, 10);
    
    if (oldVal !== newVal) {
      selectedRecord['CurrentJobSecurityPercentage'] = newVal;
      editCount++;
      console.log(`Updated ${coachName} from ${oldVal}% -> **${newVal}%**.\n`);
    } else {
      console.log(`No change made to ${coachName}.\n`);
    }

    // D. Ask if the user wants to edit another coach or exit
    keepEditing = await confirm({
      message: 'Would you like to edit another coach?',
      default: true
    });
    
    console.log('--------------------------------------------------');
  }

  // =========================================================================
  // 6. BATCH SAVE AT THE VERY END
  // =========================================================================
  if (editCount > 0) {
    console.log(`\nYou made ${editCount} total edit(s). Saving changes to disk...`);
    await franchise.save();
    console.log('Done! All changes successfully saved to your dynasty file.');
  } else {
    console.log('\nNo edits were made. Exiting without saving.');
  }
}

main().catch(err => console.error('Error:', err));